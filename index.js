const MongoClient = require('mongodb').MongoClient;
const express = require('express');
const crypto = require('crypto');

function random_bytes(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
};

const app = express();
const port = 3000;
const uri = "mongodb+srv://admin:Afs3rAp8b8q0jGGj@cluster0.gozvphc.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
const dbName = "db_progetto";
let db;
let users;
let recipes;
let storage;
let recipes_query = null;
let last_fetched_recipes = 0;

async function connect(){
    try{
        await client.connect();
        db = client.db(dbName);
        users = db.collection("users");
        recipes = db.collection("recipes");
        storage = db.collection("storage");
    }
    catch(e){
        console.log(e);
    }
}

let sessions = {};
let alive_session_per_id = {};  //check if there is only 1 session per user id

function check_session(sid) {
    return !(sid in sessions);
}

async function check_credentials(username, psw) {
    let user = await users.findOne({username: username});
    if(user == null) return null;
    if(user.psw == psw)
    {
        return parseInt(user._id.valueOf(), 16);
    }
    return null;
}
function insert_credentials(mail, psw) {
    let id = random_bytes(16);
    //todo: check if email is already used
    //todo: send verification email
    //todo: verificate email
}
function generate_session_id(id) {
    let sid = 0;
    do{
        sid = random_bytes(16);
    }while(sid in sessions);

    if(id in alive_session_per_id)
        delete sessions[alive_session_per_id[id]];  //todo: add multiple sessions per user

    sessions[sid] = {id: id, time: Date.now()};
    alive_session_per_id[id] = sid;
    return sid;
}
async function add_ingredient(id, name, expiration) {
    let st = await storage.findOne({userId: id});
    if(st == null)
    {
        st = {userId: id, ingredients: []};
        await storage.insertOne(st);
    }
    st.ingredients.push({name: name, expiration: expiration});
    await storage.replaceOne({userId: id}, st);
}
async function get_ingredients(id) {
    let st = await storage.findOne({userId: id});
    if(st == null) return null;
    return st.ingredients;
}
async function get_recipes() {
    if(recipes_query == null)
        recipes_query = await recipes.find().toArray();
    return recipes_query;
}
async function get_possible_recipes(id) {
    let ingredients = await get_ingredients(id);
    let s = new Set(ingredients.map(t => t.name));
    let recipes = await get_recipes();
    console.log("recipes", recipes);
    let ret_recipes = []

    for(let i=0;i<recipes.length;i++) {
        let missing = [];
        let cnt = 0;
        for(let j=0;j<recipes[i].ingredients.length;j++)
        {
            let ing = Object.keys(recipes[i].ingredients[j])[0];
            if(!s.has(ing))
            {
                cnt++;
                missing.push(ing);
            }
        }
        ret_recipes.push([recipes[i].title, missing, cnt]);
    }
    ret_recipes.sort((a,b) => a[2]-b[2]);
    return ret_recipes.slice(0, 10);
}

/*
    /login
    params:{
        username: str,
        password: str
    }
    return:{
        sessionId: str
    }
*/
app.get('/login', async (req, res) => {
    let type = req.query.type;
    let id = null;
    if(type == 'guest')
    {
        id = req.query.id;
        console.log(id)
    }
    else
    {
        let username = req.query.username;
        let psw = req.query.psw;
        id = await check_credentials(username, psw);
    }
    if(id != null)
    {
        let sid = generate_session_id(id);
        res.send({sessionId: sid});
    }
    else
    {
        res.send({"error": "Wrong Credentials"});
    }
});

/*
    /register
    non va (ancora)
*/
app.get('/register', (req, res) => {
    let mail = req.query.mail;
    let psw = req.query.psw;
    res.send(insert_credentials());
});

/*
    /add
    params:{
        sid: str,   (session id)
        expiration: date,
        ingredient: str
    }
    return:{
        ok
    }
*/
app.get('/add', (req, res) => {
    let ingredient = req.query.ingredient;
    let expiration = req.query.expiration;
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.send("session not found");
        return;
    }
    let id = sessions[sid].id;
    add_ingredient(id, ingredient, expiration);
    res.send("ok");
});

/*
    /ingredients
    params:{
        sid: str
    }
    return:{
        list of ingredients of the user
    }
*/
app.get('/ingredients', async (req, res) => {
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.send("session not found");
        return;
    }
    let id = sessions[sid].id;
    let ingredients = await get_ingredients(id);
    res.send(ingredients);
});

/*
    /recipes
    params:{
        sid: str
    }
    return:{
        list of possible recipes of the user
    }
*/
app.get('/recipes', async (req, res) => {
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.send("session not found");
        return;
    }
    let id = sessions[sid].id;
    let ret = await get_possible_recipes(id);
    res.send(ret);
});

/*
    /guest_registration
    params:{
    }
    return:{
        sid: string
    }
*/
app.get('/guest_registration', (req, res) => {
    let id = random_bytes(16);
    while(false) {      //todo: check if already created
        id = random_bytes(16);
    }
    res.send(id);
});

/*
    only for debug
*/
app.get('/sessions', (req, res) => {
    res.send(JSON.stringify(sessions));
});


connect();
app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));