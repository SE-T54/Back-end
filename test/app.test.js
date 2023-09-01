import app from '../app.js'
import request from 'supertest'

beforeAll(async () => {
    await app.connect();
});

describe("GET /login", () => {
    describe("given a valid email and password", () => {

        test("should respond with a 200 status code", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "test"
            })
            expect(response.statusCode).toBe(200)
        })
        test("should return the session id", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "test"
            })
            expect(response.headers['content-type']).toEqual(expect.stringContaining("json"))
        })
        test("response has userId", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "test"
            })
            expect(response.body.sessionId).toBeDefined()
        })
    })
    
    describe("given an invalid email or password", () => {

        test("should respond with a 400 status code", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "wrong_password"
            })
            expect(response.statusCode).toBe(400)
        })
    })
})

describe("/register and /delete_account", () => {
    describe("POST /register", () => {
        describe("given a valid username and password", () => {
            test("should respond with a 200 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "example@example.com",
                    username: "example_username",
                    psw: "password"
                })
                expect(response.statusCode).toBe(200)
            })
        })
        describe("given an already used email", () => {
            test("should respond with a 400 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "test@gmail.com",
                    username: "example_username",
                    psw: "password"
                })
                expect(response.statusCode).toBe(400)
                expect(response.text).toBe("email already used")
            })
        })
        describe("given an invalid email", () => {
            test("should respond with a 401 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "invalid_email",
                    username: "example_username",
                    psw: "password"
                })
                expect(response.statusCode).toBe(401)
                expect(response.text).toBe("email not valid")
            })
        })
    })
    describe("DELETE /delete_account", () => {
        describe("given valid sid", () => {
            test("should respond with a 200 status code", async () => {
                const login = await request(app.app).post("/login").send({
                    email: "example@example.com",
                    psw: "password"
                })
                expect(login.body.sessionId).toBeDefined()
                const response = await request(app.app).delete("/delete_account").send({
                    sid: login.body.sessionId
                })
                expect(response.statusCode).toBe(200)
            })
        })
        describe("given invalid sid", () => {
            test("should respond with a 200 status code", async () => {
                const response = await request(app.app).delete("/delete_account").send({
                    sid: -1
                })
                expect(response.statusCode).toBe(403)
            })
        })
    })
})


describe("GET /guest_registration", () => {
    let sid = "";
    test("should respond with a 200 status code and a new SID", async () => {
        const response = await request(app.app).get("/guest_registration").send()
        expect(response.statusCode).toBe(200)
        expect(response.text).toBeDefined()
        sid = response.text
    })
    test("check if is a guest", async () => {
        const check = await request(app.app).get("/user?sid="+sid).send();
        expect(check.statusCode).toBe(200);
        expect(check.body.guest).toBeDefined();
        expect(check.body.guest).toBe(true);
    })
})