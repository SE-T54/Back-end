import app from '../app.js'
import request from 'supertest'

beforeAll(async () => {
    await app.connect();
});

describe("GET /login", () => {
    describe("given a valid email and password", () => {
        let sid;
        test("should respond with a 200 status code", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "test"
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toEqual(expect.stringContaining("json"));
            expect(response.body.sessionId).toBeDefined();
        })
        test("login with same user", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "test"
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toEqual(expect.stringContaining("json"));
            expect(response.body.sessionId).toBeDefined();
            sid = response.body.sessionId;
        })
        test("GET /user for non authenticated user", async () => {
            let response = await request(app.app).get("/user?sid="+sid).send();
            expect(response.statusCode).toBe(200);
            expect(response.body.guest).toBeDefined();
            expect(response.body.username).toBeDefined();
            expect(response.body.guest).toBe(false);
            expect(response.body.username).toBe("test");
        })
    })
    
    describe("given an invalid email or password", () => {

        test("should respond with a 400 status code", async () => {
            const response = await request(app.app).post("/login").send({
                email: "test@gmail.com",
                psw: "wrong_password"
            });
            expect(response.statusCode).toBe(400);
        })
    })
})

describe("/register /change_password /delete_account", () => {
    describe("POST /register", () => {
        describe("given a valid username and password", () => {
            test("should respond with a 200 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "example@example.com",
                    username: "example_username",
                    psw: "password"
                });
                expect(response.statusCode).toBe(200);
            })
        })
        describe("given an already used email", () => {
            test("should respond with a 400 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "test@gmail.com",
                    username: "example_username",
                    psw: "password"
                });
                expect(response.statusCode).toBe(400);
                expect(response.text).toBe("email already used");
            })
        })
        describe("given an invalid email", () => {
            test("should respond with a 401 status code", async () => {
                const response = await request(app.app).post("/register").send({
                    mail: "invalid_email",
                    username: "example_username",
                    psw: "password"
                });
                expect(response.statusCode).toBe(401);
                expect(response.text).toBe("email not valid");
            })
        })
    })
    let sid;
    describe("POST /change_password", () => {
        test("the new password is the same as the old one", async () => {
            const login = await request(app.app).post("/login").send({
                email: "example@example.com",
                psw: "password"
            });
            sid = login.body.sessionId;
            let response = await request(app.app).post("/change_password").send({
                sid: sid,
                old_psw: 'password',
                new_psw: "password"
            })
            expect(response.statusCode).toBe(402);
        })
        test("invalid session id", async () => {
            let response = await request(app.app).post("/change_password").send({
                sid: -1,
                old_psw: 'password',
                new_psw: "password2"
            })
            expect(response.statusCode).toBe(403);
        })
        test("wrong old password", async () => {
            let response = await request(app.app).post("/change_password").send({
                sid: sid,
                old_psw: 'passwor',
                new_psw: "password"
            })
            expect(response.statusCode).toBe(405);
        })
        test("ok", async () => {
            let response = await request(app.app).post("/change_password").send({
                sid: sid,
                old_psw: 'password',
                new_psw: "password2"
            })
            expect(response.statusCode).toBe(200);
        })
    })
    describe("DELETE /delete_account", () => {
        describe("given valid sid", () => {
            test("should respond with a 200 status code", async () => {
                const response = await request(app.app).delete("/delete_account").send({
                    sid: sid
                });
                expect(response.statusCode).toBe(200);
            })
        })
        describe("given invalid sid", () => {
            test("should respond with a 200 status code", async () => {
                const response = await request(app.app).delete("/delete_account").send({
                    sid: -1
                });
                expect(response.statusCode).toBe(403);
            })
        })
    })
})


describe("Authenticated operations", () => {
    let sid;
    describe("GET /guest_registration", () => {
        test("should respond with a 200 status code and a new SID", async () => {
            const response = await request(app.app).get("/guest_registration").send();
            expect(response.statusCode).toBe(200);
            expect(response.text).toBeDefined();
            sid = response.text;
        })
        test("check if is a guest", async () => {
            const check = await request(app.app).get("/user?sid="+sid).send();
            expect(check.statusCode).toBe(200);
            expect(check.body.guest).toBeDefined();
            expect(check.body.guest).toBe(true);
        })
    })

    describe("GET /recipes", () => {
        test("valid SID", async () => {
            const response = await request(app.app).get("/recipes?sid="+sid).send();
            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBe(10);
        })
        test("invalid SID", async () => {
            const response = await request(app.app).get("/recipes?sid=-1").send();
            expect(response.statusCode).toBe(403);
        })
    })

    describe("GET /ingredients", () => {
        test("invalid sid", async () => {
            let response = await request(app.app).get("/ingredients?sid="+"-1").send();
            expect(response.statusCode).toBe(403);
        })
    })

    describe("/add and /remove", () => {
        describe("POST /add", () => {
            test("valid SID and valid ingredient", async () => {
                const response = await request(app.app).post("/add").send({
                    sid: sid,
                    ingredient: {
                        name: "test",
                        expiration: "01/01/2100",
                        quantity: 1
                    }
                })
                expect(response.statusCode).toBe(200);
                expect(response.text).toBe("ok");
                let ingredients = (await request(app.app).get("/ingredients?sid="+sid).send()).body;
                expect(ingredients.some(x => x.name == "test")).toBe(true);
            })
            test("invalid SID", async () => {
                const response = await request(app.app).post("/add").send({
                    sid: -1,
                    ingredient: {
                        name: "test",
                        expiration: "01/01/2100",
                        quantity: 1
                    }
                })
                expect(response.statusCode).toBe(403);
            })
            test("invalid ingredient format", async () => {
                const response = await request(app.app).post("/add").send({
                    sid: sid,
                    ingredient: {
                        noname: "aaa",
                        noexpiration: "01/01/2100"
                    }
                })
                expect(response.statusCode).toBe(401);
            })
        })
        describe("DELETE /remove", () => {
            test("valid SID and valid index", async () => {
                for(let i=0;i<3;i++)
                    await request(app.app).post("/add").send({sid:sid,ingredient:{name:"test"+i,expiration:"01/01/2100",quantity:1}});
                
                const response = await request(app.app).delete("/remove").send({
                    sid: sid,
                    ingredient: 0
                });
                expect(response.statusCode).toBe(200);
                let ingredients = (await request(app.app).get("/ingredients?sid="+sid).send()).body;
                expect(ingredients.length).toBe(3);
            })
            test("invalid SID and valid index", async () => {
                const response = await request(app.app).delete("/remove").send({
                    sid: -1,
                    ingredient: 0
                });
                expect(response.statusCode).toBe(403);
            })
            test("valid SID and invalid index", async () => {
                const response = await request(app.app).delete("/remove").send({
                    sid: sid,
                    ingredient: 3
                });
                expect(response.statusCode).toBe(402);
            })
            test("storage not created yet", async () => {
                const login = await request(app.app).get("/guest_registration").send();
                let tsid = login.text;
                const response = await request(app.app).delete("/remove").send({
                    sid: tsid,
                    ingredient: 0
                });
                expect(response.statusCode).toBe(400);
            })
        })
    })
})