/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const request = require("supertest");
const db = require("../models/index");
const app = require("../app");

let server, agent;

describe("Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(3000, () => {});
    agent = request.agent(server);
  });
  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Create a todo and responds with json at /todos POST endpoint", async () => {
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
    });
    expect(response.statusCode).toBe(302);
    // expect(response.header["content-type"]).toBe(
    //   "application/json; charset=utf-8"
    // );
    // const parsedResponse = JSON.parse(response.text);
    // expect(parsedResponse.id).toBeDefined();
  });

  // test("Marks a todo with the given Id as completed", async () => {
  //   const response = await agent.post("/todos").send({
  //     title: "Buy milk",
  //     dueDate: new Date().toISOString(),
  //     completed: false,
  //   });
  //   const parsedResponse = JSON.parse(response.text);
  //   const todosID = parsedResponse.id;

  //   expect(parsedResponse.completed).toBe(false);

  //   const markAsCompletedResponse = await agent
  //     .put(`/todos/${todosID}/markAsCompleted`)
  //     .send();
  //   const parsedUpdateResponse = JSON.parse(markAsCompletedResponse.text);
  //   expect(parsedUpdateResponse.completed).toBe(true);
  // });

  test("Fetches all todos in the database using /todos endpoint", async () => {
    await agent.post("/todos").send({
      title: "Buy xbox",
      dueDate: new Date().toISOString(),
      completed: false,
    });
    await agent.post("/todos").send({
      title: "Buy ps3",
      dueDAte: new Date().toISOString(),
      completed: false,
    });
    const response = await agent.get("/todos");
    const parsedResponse = JSON.parse(response.text);

    expect(parsedResponse.length).toBe(3);
    expect(parsedResponse[2]["title"]).toBe("Buy ps3");
  });

  test("Deletes a todo with the given ID if it exits and sends a boolean response", async () => {});
});
