// Verified migration map. No message content or database credentials belong here.
export const migratedAskQuestions = [
  [
    "0ab62fd5-e9fd-417f-a04f-311dd44e3821",
    "q_3f1cc2654118ba1f7a2f1230f04e"
  ],
  [
    "2d9e83a7-aa88-430b-8747-d39e939501ba",
    "q_dbf7fdd02862929a321b6f0cfb81"
  ],
  [
    "2db31e20-18a8-4611-ab29-012b41f812fe",
    "q_8ce718b5ec072370c8980855a34d"
  ],
  [
    "2ecf83d7-052c-4793-b26f-8090a8ab770a",
    "q_b2c89131ccddd88e9b1e8b2f567d"
  ],
  [
    "30188efc-8c1d-422e-9ec8-f031ab09321c",
    "q_97c85d5120b79416b4b3b4289563"
  ],
  [
    "381515db-f61b-4947-bfa5-5af42a9c266d",
    "q_6b474791155869e02c832559c293"
  ],
  [
    "3a4634d1-39a0-4c1e-a30d-4e059245791f",
    "q_27a83cfc715d1df89d4c74677771"
  ],
  [
    "407bb12e-2016-4664-a91c-a06a8e4d6c7e",
    "q_4e5010e17f67665ad145bd118034"
  ],
  [
    "4b6ee16a-b29c-49f3-94e2-6943f2219afd",
    "q_aa22dc42195b21a6e3d0bdce4886"
  ],
  [
    "53581458-5cf7-4f7d-8b78-679efb71ac18",
    "q_e1d57cb7c36c2036364ef3469248"
  ],
  [
    "74ce4d9f-eeef-4ed7-96f7-abcf52d4bbf6",
    "q_9ca4e59591a2197e6e99a25d088e"
  ],
  [
    "7891ec4f-0ab1-4bdd-a7d3-b7d1aa96ad84",
    "q_9c9613fd4cd2155a1aaf7de04aec"
  ],
  [
    "81a7be8b-558f-4433-ba8c-80e647ee7e8e",
    "q_f5d39085bd2aca967931e55b19f9"
  ],
  [
    "a9496d88-df0a-4d45-968c-6fedbb1b5804",
    "q_db01085b60282db9efd9f916ca97"
  ],
  [
    "b343022e-a5f7-4eb5-9348-364f5096bcb4",
    "q_8499474a7b7768954fc924408ae5"
  ],
  [
    "be13d886-ead4-4593-b971-0c6c62e4d6a8",
    "q_3f2cf5d32f79b1f51cdb8f2ec6a4"
  ],
  [
    "dfd1908b-61fa-4573-a772-cb8951719bfb",
    "q_9e5308240b9d76b5b6e7a9b18fe8"
  ]
];

export const askCutoverRedirects = [
  { source: "/ask", destination: "https://unsaidbox.com/u/tochukwu", permanent: false },
  { source: "/ask/question", destination: "https://unsaidbox.com/u/tochukwu/ask", permanent: false },
  ...migratedAskQuestions.flatMap(([sourceId, targetId]) => [
    { source: `/ask/${sourceId}/answer`, destination: `https://unsaidbox.com/q/${targetId}/answer`, permanent: false },
    { source: `/ask/${sourceId}`, destination: `https://unsaidbox.com/q/${targetId}`, permanent: false },
  ]),
];

