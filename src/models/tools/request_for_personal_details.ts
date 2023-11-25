export const requestForPersonalDetailsTool = 
{
    "name": "request_for_personal_details",
    "description": `Ask the user for their personal details. 
    Choose this action if the user profile is missing details: age, gender, marital status or any 
    other detail that can assist in the conversation.`,
    "parameters": {
        "detailToAskFor": {
            "type": "string",
            "description": "The missing personal detail of the user to ask for",
            "enum": [
              "age",
              "marital status",
              "location"
            ]
          }
    }
}

export const requestForPersonalDetails = (detailToAskFor: string) => {
    console.log("Asking for: ", detailToAskFor);
};