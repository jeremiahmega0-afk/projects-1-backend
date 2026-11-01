const { createCommentSchema } = require("./src/validations/comment.validation");

const tests = [
  {
    name: "Valid text comment",
    data: {
      type: "text",
      content: "This article is helpful!",
    },
    expected: true,
  },
  {
    name: "Valid sticker comment",
    data: {
      type: "sticker",
      stickerUrl: "https://example.com/sticker.png",
    },
    expected: true,
  },
  {
    name: "Valid audio comment",
    data: {
      type: "audio",
      audioUrl: "https://example.com/audio.mp3",
      audioDuration: 30,
    },
    expected: true,
  },
  {
    name: "Empty text comment",
    data: {
      type: "text",
      content: "",
    },
    expected: false,
  },
  {
    name: "Invalid comment type",
    data: {
      type: "video",
      content: "Hello there!",
    },
    expected: false,
  },
  {
    name: "Invalid sticker URL",
    data: {
      type: "sticker",
      stickerUrl: "not-a-url",
    },
    expected: false,
  },
  {
    name: "Audio duration above 300 seconds",
    data: {
      type: "audio",
      audioUrl: "https://example.com/audio.mp3",
      audioDuration: 400,
    },
    expected: false,
  },
  {
    name: "Extra unwanted field",
    data: {
      type: "text",
      content: "Hello there!",
      author: "fake-user-id",
    },
    expected: false,
  },
];

let passed = 0;

for (const test of tests) {
  const result = createCommentSchema.safeParse(test.data);
  const success = result.success === test.expected;

  if (success) {
    passed++;
    console.log(`PASS: ${test.name}`);
  } else {
    console.log(`FAIL: ${test.name}`);
    console.log(result.error?.issues);
  }
}

console.log(`\nResults: ${passed}/${tests.length} tests passed.`);