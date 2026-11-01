
const mongoose = require("mongoose");
const Comment = require("./src/models/comment.model");

const testCommentModel = async () => {
  // Fake IDs for testing. No real user or article is needed.
  const authorId = new mongoose.Types.ObjectId();
  const articleId = new mongoose.Types.ObjectId();

  const tests = [
    {
      name: "Text comment",
      data: {
        type: "text",
        content: "This article is very helpful!",
        author: authorId,
        article: articleId,
      },
    },
    {
      name: "Sticker comment",
      data: {
        type: "sticker",
        stickerUrl: "https://example.com/sticker.png",
        author: authorId,
        article: articleId,
      },
    },
    {
      name: "Audio comment",
      data: {
        type: "audio",
        audioUrl: "https://example.com/audio.mp3",
        audioDuration: 30,
        author: authorId,
        article: articleId,
      },
    },
  ];

  for (const test of tests) {
    const comment = new Comment(test.data);

    try {
      await comment.validate();
      console.log(`PASS: ${test.name}`);
    } catch (error) {
      console.log(`FAIL: ${test.name}`);
      console.log(error.message);
    }
  }

  // Test invalid text comment
  const invalidComment = new Comment({
    type: "text",
    content: "",
    author: authorId,
    article: articleId,
  });

  try {
    await invalidComment.validate();
    console.log("FAIL: Empty text was accepted");
  } catch (error) {
    console.log("PASS: Empty text was rejected");
  }

  console.log("Comment model testing completed!");
};

testCommentModel();

