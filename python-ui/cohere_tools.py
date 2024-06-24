import json
import os
from copy import copy
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import wraps
from itertools import chain
from time import sleep
from typing import Any, Callable
from uuid import uuid4, UUID
from warnings import warn

import requests
from requests import Response
from stamina import retry

ENDPOINT_PREFIX: str = "https://api.cohere.com/v1/"


class EndpointModelMap(Enum):
    classify = 'embed-multilingual-light-v3.0'
    embed = 'embed-multilingual-light-v3.0'
    chat = 'c4ai-aya-23'
    rerank = 'rerank-multilingual-v3.0'


@dataclass
class GenCfg:
    # Reference: https://docs.cohere.com/reference/chat
    temperature: float = 0.7
    k: int = 10  # 0 to 500, AKA top_k
    p: float = 0.5  # AKA top_p
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    prompt_truncation: str = None  # Options are "OFF", "AUTO_PRESERVE_ORDER" or "AUTO"
    citation_quality: str = "accurate"   # Options are "accurate" or "fast"

    def parse(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class Document:
    text: str
    title: str | type(None) = None
    author: str | type(None) = None
    date: str | type(None) = None

    def parse(self):
        return {k: v for k, v in asdict(self).items() if v is not None}


class StandardRoles(Enum):
    system = "SYSTEM"
    user = "USER"
    assistant = "CHATBOT"
    tool = "TOOL"


@dataclass
class ConvMsg:
    role: StandardRoles | str
    msg: str

    def parse(self) -> dict[str, str]:
        d = asdict(self)
        if isinstance(self.role, StandardRoles):
            d["role"] = self.role.value
        return d


@dataclass
class ConvHist:
    def __init__(self, sys_msg: str = None, msgs: list[ConvMsg] = None):
        self.msgs: list[ConvMsg] = msgs or []
        self.sys_msg = sys_msg or ""

    def parse(self, include_sys_msg: bool = False) -> dict[str, str | list[dict[str, str]]]:
        # API reference: https://docs.cohere.com/reference/chat
        chat_hist_json = {}
        if self.msgs:
            chat_hist_json["chat_history"] = [m.parse() for m in self.get_all_msgs(include_sys_msg=False)]
        if self.sys_msg and include_sys_msg:
            chat_hist_json["preamble"] = self.sys_msg
        return chat_hist_json

    def add_msg(self, msg: str | ConvMsg, role: str | StandardRoles = None):
        if role and isinstance(msg, str):
            parsed_msg = ConvMsg(role, msg)
        elif role is None and isinstance(msg, ConvMsg):
            parsed_msg = msg
        else:
            raise ValueError(f"A new message must be with a ConvMsg with role=None, or a string with role. "
                             f"Received {role=} of type {type(role)}, and {msg=} of type {type(msg)}.")
        self.msgs.append(parsed_msg)

    def get_all_msgs(self, include_sys_msg: bool = False) -> list[ConvMsg]:
        if include_sys_msg:
            return [ConvMsg(StandardRoles.system, self.sys_msg)] + self.msgs
        return self.msgs

    def update_msgs(self, msgs: list[ConvMsg], sys_msg: str = None, update_sys_msg: bool = False):
        self.msgs = msgs
        if update_sys_msg:
            self.sys_msg = sys_msg if isinstance(sys_msg, str) else ""


@dataclass
class ConvHistoriesManager:
    histories: dict[UUID, ConvHist] = field(default_factory=dict)

    def new_conv(self, sys_prompt: str = None, init_history: ConvHist=None) -> UUID:
        conv_id: UUID = uuid4()
        self.histories[conv_id] = ConvHist(sys_prompt, init_history)
        return conv_id

    def update_sys_prompt(self, conv_id: UUID, sys_prompt: str):
        self.histories[conv_id].sys_msg = sys_prompt

    def add_msg(self, conv_id: UUID, msg: ConvMsg | str, role: StandardRoles | str = None):
        self.histories[conv_id].add_msg(msg, role)

    def __getitem__(self, conv_id: UUID) -> ConvHist:
        return self.histories[conv_id]

    def get_msgs(self, conv_id: UUID, include_sys_msg: bool = False) -> list[ConvMsg]:
        return self[conv_id].get_all_msgs(include_sys_msg)

    def update_msgs(self, conv_id: UUID, msgs: list[ConvMsg], sys_msg: str = None, update_sys_msg: bool = False):
        self.histories[conv_id].update_msgs(msgs, sys_msg, update_sys_msg)


ChatReplay = dict[str, str | list[dict[str, str]] | dict[str, dict[str, str]]]


@dataclass
class CohereHandler:
    base_headers: dict[str, str] = field(init=False)
    model_headers: dict[str, str] = field(init=False)
    endpoint_to_model_map: dict[str, str] = field(init=False)

    def __post_init__(self):
        try:
            api_key: str = os.environ['CohereKey']
        except KeyError:
            api_key: str = "CIeOH3okrDULOuetqeVzJ8qDAkfIMN5Zfh0qC3G0"
        auth_str: str = f"bearer {api_key}"
        self.base_headers: dict[str, str] = {"accept": "application/json", "Authorization": auth_str}
        self.model_headers: dict[str, str] = self.base_headers | {'content-type': 'application/json'}
        # Checking API access and validating the API key
        response: Response = requests.post(f"{ENDPOINT_PREFIX}check-api-key", headers=self.base_headers)
        if not response.status_code == 200:
            raise ConnectionError("Couldn't connect to the Cohere API. Check the internet connection.")
        if not response.json()["valid"]:
            raise KeyError(f"Couldn't connect to the Cohere API with the provided API key. "
                           f"Make sure a valid API key is available in the env var CohereKey.\n"
                           f"The response from the check-api-key endpoint: {response.json()}")

        # Validating the requested model list
        response: Response = requests.get(f"{ENDPOINT_PREFIX}models", headers=self.base_headers)
        available_models: list[dict[str, str]] = response.json()["models"]
        available_endpoints: set[str] = set(chain(*(m["endpoints"] for m in available_models)))
        self.available_endpoint_models: dict[str, set[str]] = {e: set(m["name"] for m in available_models
                                                                      if e in m['endpoints'])
                                                               for e in available_endpoints}
        requested_endpoints = set(el.name for el in EndpointModelMap)
        unavailable_endpoints = requested_endpoints - available_endpoints
        if unavailable_endpoints:
            warn(f"Some requested endpoints in endpoint_to_model_map aren't available. "
                 f"The endpoints {unavailable_endpoints} aren't available. Available endpoints: {available_endpoints}.")
            for endpoint in unavailable_endpoints:
                _ = self.endpoint_to_model_map.pop(endpoint)
        self.endpoint_to_model_map: dict[str, str | type(None)] \
            = {endpoint: EndpointModelMap[endpoint].value for endpoint in requested_endpoints & available_endpoints}
        for endpoint, model in self.endpoint_to_model_map.items():
            if model not in self.available_endpoint_models[endpoint]:
                warn(f"The model {model} isn't available for the {endpoint} endpoint. Switching to default. "
                     f"Available models for this endpoint: {self.available_endpoint_models[endpoint]}")
                self.endpoint_to_model_map[endpoint] = None

    @retry(on=requests.RequestException, attempts=5, wait_initial=300)
    def call_endpoint(self, endpoint: EndpointModelMap, data: dict[str, Any], model: str = None) -> dict:
        if model:
            endpoint_available_models = self.available_endpoint_models[endpoint.name]
            if model in endpoint_available_models:
                data["model"] = model
            else:
                warn(f"Requested {model=} for endpoint {endpoint.name}. This model is unavailable, defaulting to "
                     f"{endpoint.value}.\n"
                     f"Available models: {endpoint_available_models}")
                data["model"] = endpoint.value
        else:
            data["model"] = endpoint.value

        data_str = json.dumps(data)
        response: Response = requests.post(f"{ENDPOINT_PREFIX}{endpoint.name}",
                                           headers=self.model_headers,
                                           data=data_str,
                                           )

        if response.status_code == 200:
            chat_reply: ChatReplay = response.json()
            return chat_reply
        if response.status_code == 429:
            raise requests.RequestException(f"Received status code 429")
        raise requests.HTTPError(f"Received status code {response.status_code} when calling the {endpoint} endpoint")

    def chat_from_dict(self, data: dict | str, cfg: GenCfg = None, model: str = None) -> ChatReplay:
        context_data = {"message": data} if isinstance(data, str) else data
        cfg = cfg or GenCfg()
        gen_data: dict = context_data | cfg.parse()
        return self.call_endpoint(EndpointModelMap.chat, gen_data, model)

    def chat(self, msg: str, conv_hist: ConvHist | UUID = None, sys_msg: str | bool = True,
             documents: list[Document] = None, cfg: GenCfg = None, model: str = None, search_queries_only: bool = False,
             ) -> ChatReplay:
        # https://docs.cohere.com/reference/chat
        # https://docs.cohere.com/docs/chat-api
        # https://docs.cohere.com/docs/retrieval-augmented-generation-rag
        # https://docs.cohere.com/docs/documents-and-citations
        if search_queries_only:
            if not documents:
                raise ValueError(f"When using {search_queries_only=}, documents must be provided but got {documents=}")

        chat_data = {"message": msg}
        if conv_hist is None:
            pass
        elif isinstance(conv_hist, UUID):
            # Cohere's API can remember the conversation if an ID is passed. To use properly the same conversation
            # must always be sent with the same id.
            # https://docs.cohere.com/docs/chat-api#using-conversation_id-to-save-chat-history
            # This functionality is untested.
            chat_data["conversation_id"] = str(conv_hist)
        elif isinstance(conv_hist, ConvHist):
            parsed_conv_hist = conv_hist.parse()
            if parsed_conv_hist:  # Add only if it's non-empty
                chat_data["chat_history"] = parsed_conv_hist
        else:
            raise TypeError(f"conv_hist must be either a UUID of a ConvHist object, but got {type(conv_hist)}.")

        if sys_msg:
            if isinstance(sys_msg, str):
                chat_data["preamble"] = sys_msg  # If provided, it overrides conv_hist.sys_msg
            # If True but not a string, keep conv_hist.sys_msg as the sys_msg if it's not empty (None or empty string)
        else:  # if provided with a None, False or empty string, make sure a system prompt isn't included
            try:
                _ = chat_data.pop("preamble")
            except KeyError:
                pass

        if documents:
            chat_data["documents"] = [doc.parse() for doc in documents]
        if search_queries_only:
            chat_data["search_queries_only"] = str(search_queries_only).lower()

        reply = self.chat_from_dict(chat_data, cfg, model)
        return reply

    def rerank(self, query: str, documents: list[str | Document], model: str = None) -> dict:
        # https://docs.cohere.com/reference/rerank
        return self.call_endpoint(EndpointModelMap.rerank, {"query": query, "documents": documents}, model)


@dataclass
class ChatLenLimiter:
    chat_callable: Callable[[str, ConvHist, str | bool, list[Document], bool, GenCfg, str], ChatReplay]
    max_chars: int = 0
    max_words: int = 0
    max_attempts_to_shorten: int = 5
    extra_shorten_multiplier: float = 0.95

    def limit_chat_len(self, msg: str, *args, chat_callable: callable = None,  **kwargs):
        chat_callable = chat_callable or self.chat_callable
        if max(self.max_chars, self.max_words) == 0:
            return chat_callable(*args, **kwargs)

        sys_msg_suffix: str = " Limit your response to "
        if self.max_chars and self.max_words:
            sys_msg_suffix += f"{self.max_chars} characters and {self.max_words} words."
        elif self.max_chars:
            sys_msg_suffix += f"{self.max_chars} characters."
        else:
            sys_msg_suffix += f"{self.max_words} words."
        reply = self.chat_callable(msg, *args, **kwargs)
        if "text" not in reply:
            # Handles the case where search_queries_only=True
            return reply
        reply_txt: str = reply["text"]

        shorten_q = 1
        num_chars, num_words, desired_over_actual_len_ratio, shorten_q = self.calc_len_and_ratio(reply_txt, shorten_q)
        tries_counter = 0
        shortened_reply_txt = copy(reply_txt)
        shortest_len_ratio = copy(desired_over_actual_len_ratio)
        while self.is_too_long(num_chars, self.max_chars) or self.is_too_long(num_words, self.max_words) \
                and tries_counter < self.max_attempts_to_shorten:
            msg = f"Shorten this text by {self.extra_shorten_multiplier * shorten_q:.0%} while keeping the same " \
                  f"style and tone. Preserve as much as the content as possible while shortening it by " \
                  f"{shorten_q:.0%}. The text to shorten:\n{reply_txt}"

            cur_reply_txt = self.chat_callable(msg, *args, **kwargs)["text"]
            num_chars, num_words, desired_over_actual_len_ratio, shorten_q = self.calc_len_and_ratio(cur_reply_txt, shorten_q)
            if desired_over_actual_len_ratio > shortest_len_ratio:
                shortened_reply_txt, shortest_len_ratio = copy(reply_txt), copy(desired_over_actual_len_ratio)
            tries_counter += 1

        reply["text"] = shortened_reply_txt
        return reply

    @staticmethod
    def count_words(text: str) -> int:
        return len(text.replace("-", " ").split(" "))

    @staticmethod
    def is_too_long(cur_len, max_len):
        return max_len and cur_len > max_len

    def calc_len_and_ratio(self, txt: str, shorten_q: float) -> tuple[int, int, float, float]:
        num_chars, num_words = len(txt), self.count_words(txt)

        char_ratio = self.max_chars / num_chars
        word_ratio = self.max_words / num_words
        len_ratio = min(char_ratio, word_ratio)
        shorten_q *= 1 - len_ratio
        return num_chars, num_words, len_ratio, shorten_q


# @dataclass
# class ChatLenLimiter:
#     chat_callable: Callable[[str, ConvHist, str | bool, list[Document], bool, GenCfg, str], ChatReplay]
#     max_chars: int = 0
#     max_words: int = 0
#     max_attempts_to_shorten: int = 5
#     extra_shorten_multiplier: float = 0.95   # If you shorten, always shorten by an extra 5%.
#
#     def limit_chat_len(self, chat_callable: callable):
#         @wraps(chat_callable)
#         def inner(*args, **kwargs):
#             if max(self.max_chars, self.max_words) == 0:
#                 return chat_callable(*args, **kwargs)
#
#             sys_msg_suffix: str = " Limit your response to "
#             if self.max_chars and self.max_words:
#                 sys_msg_suffix += f"{self.max_chars} characters and {self.max_words} words."
#             elif self.max_chars:
#                 sys_msg_suffix += f"{self.max_chars} characters."
#             else:
#                 sys_msg_suffix += f"{self.max_words} words."
#             reply = self.chat_callable(*args, **kwargs)
#             reply_txt: str = reply["text"]
#
#             shorten_q = 1
#             num_chars, num_words, len_ratio, shorten_q = self.calc_len_and_ratio(reply_txt, shorten_q)
#             tries_counter = 0
#             shortened_reply_txt = copy(reply_txt)
#             shortest_len_ratio = copy(len_ratio)
#             while self.is_too_long(num_chars, self.max_chars) or self.is_too_long(num_words, self.max_words) \
#                     and tries_counter < self.max_attempts_to_shorten:
#                 msg = f"Shorten this text by {self.extra_shorten_multiplier * shorten_q:.0%} while keeping the same " \
#                       f"style and tone. Preserve as much as the content as possible while shortening it by " \
#                       f"{shorten_q:.0%}. The text to shorten:\n{reply_txt}"
#
#                 updated_args = tuple([msg] + list(args[1:]))
#                 shortened_reply_txt = self.chat_callable(*updated_args, **kwargs)["text"]
#                 num_chars, num_words, len_ratio, shorten_q = self.calc_len_and_ratio(reply_txt, shorten_q)
#                 if len_ratio > shortest_len_ratio:
#                     shortened_reply_txt, shortest_len_ratio = copy(reply_txt), copy(len_ratio)
#                 tries_counter += 1
#
#             return reply
#
#     @staticmethod
#     def count_words(text: str) -> int:
#         return len(text.replace("-", " ").split(" "))
#
#     @staticmethod
#     def is_too_long(cur_len, max_len):
#         return max_len and cur_len > max_len
#
#     def calc_len_and_ratio(self, txt: str, shorten_q: float) -> tuple[int, int, float, float]:
#         num_chars, num_words = len(txt), self.count_words(txt)
#
#         char_ratio = self.max_chars / num_chars
#         word_ratio = self.max_words / num_words
#         len_ratio = min(char_ratio, word_ratio)
#         shorten_q *= 1 - len_ratio
#         return num_chars, num_words, len_ratio, shorten_q

ChatCallable = Callable[[str, ConvHist, str], str | ChatReplay]


@dataclass
class ConvManager(ConvHistoriesManager):
    # histories: ConvHistoriesManager = field(default_factory=ConvHistoriesManager)
    default_gen_cfg: GenCfg = field(default_factory=GenCfg)
    llm_handler: CohereHandler = field(default_factory=CohereHandler)

    def reply_to_msg(self, conv_id: UUID, msg: str, sys_msg: str = None, func: ChatCallable = None,
                          update_hist: bool = True, return_json: bool = False) -> str | ChatReplay:
        func: ChatCallable = func or self.llm_handler.chat
        # noinspection PyTypeChecker
        bot_reply = func(msg, self.histories[conv_id], sys_msg)
        bot_reply_txt = bot_reply["text"]
        if update_hist:
            self.add_msg(conv_id, msg, StandardRoles.user)
            self.add_msg(conv_id, bot_reply, StandardRoles.assistant)
        return bot_reply if return_json else bot_reply_txt


if __name__ == "__main__":
    llm_handler = CohereHandler()
    bot_resp = llm_handler.chat("Tell me aboot yourself")

    histories = ConvHistoriesManager()
    coding_conv_id = histories.new_conv("You are a coding assistant named CodeBot. "
                                        "You are an expert Python coder and you write clean concise code.")
    msg = "Write a short Python script to multiply the elements of two iterables."
    bot_reply = llm_handler.chat(msg, histories[coding_conv_id])["text"]
    histories.add_msg(coding_conv_id, msg, StandardRoles.user)
    histories.add_msg(coding_conv_id, bot_reply, StandardRoles.assistant)
    print(histories[coding_conv_id].get_all_msgs())
    histories.update_sys_prompt(coding_conv_id,
                                "You are a chaos agent, "
                                "your code is meant to check the tests and see if they catch all the problems with "
                                "minimal code. Make sure to include both clear and subtle bugs and fail a variety of "
                                "tests with as little code as possible.")
    print(histories[coding_conv_id])

    query = 'Which animal has the longest tail?'
    documents = ['An elephant is the largest land animal and has a relatively short tail.',
                 'A beaver has a long flat tail.',
                 'A nake is basically all tail except for their head. An Anaconda snake is the longest animal in nature.'
                 ]
    rerank_resp = llm_handler.rerank(query, documents)

    convs_mgnr = ConvManager()
    convs_mgnr.reply_to_msg("Tell me about yourself", )
    1+1
