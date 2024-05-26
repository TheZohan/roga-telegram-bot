import { ChatCompletionMessageParam } from "openai/resources";

export interface OpenAiTool {
    type: "function";
    function: ChatCompletionMessageParam.FunctionCall;
}