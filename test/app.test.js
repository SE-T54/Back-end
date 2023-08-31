import app from '../app.js'
import request from 'supertest'

beforeAll(async () => {
    await app.connect();
});

describe("GET /login", () => {
    describe("given a valid username and password", () => {

        test("should respond with a 200 status code", async () => {
            const response = await request(app.app).get("/login?username=test&psw=test").send()
            expect(response.statusCode).toBe(200)
        })
        test("should return the session id", async () => {
            const response = await request(app.app).get("/login?username=test&psw=test").send()
            expect(response.headers['content-type']).toEqual(expect.stringContaining("json"))
        })
        test("response has userId", async () => {
            const response = await request(app.app).get("/login?username=test&psw=test").send()
            expect(response.body.sessionId).toBeDefined()
        })
    })
})