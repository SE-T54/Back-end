//const MongoClient = require('mongodb').MongoClient;
import { MongoClient } from 'mongodb';
//const express = require('express');
import express from 'express';
//const crypto = require('crypto');
import crypto from 'crypto';
//const cors = require('cors');
import cors from 'cors';
//const swaggerUi = require('swagger-ui-express')
import swaggerUi from 'swagger-ui-express';
//const YAML = require('yamljs');
import YAML from 'yamljs';
const swaggerDocument = YAML.load('./swagger.yaml');

function random_bytes(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
};

const app = express();
const uri = process.env.uri;
const client = new MongoClient(uri);
const dbName = "db_progetto";
let db;
let users;
let guests;
let recipes;
let ingredients;
let storage;
let recipes_query = null;
let ingredients_query = null;
let last_fetched_recipes = 0;

let sessions = {};
let is_guest = new Set();
let alive_session_per_id = {};  //check if there is only 1 session per user id

app.use(cors());

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

async function connect(){
    try{
        await client.connect();
        db = client.db(dbName);
        users = db.collection("users");
        guests = db.collection("guests");
        recipes = db.collection("recipes");
        storage = db.collection("storage");
        ingredients = db.collection("ingredients")
        let guest_ids = await guests.find().toArray();
        guest_ids.forEach((e) => {is_guest.add(e.id); sessions[e.id] = {id: e.id, time: Date.now()}});
        await get_recipes();
    }
    catch(e){
        console.log(e);
    }
}

const validateEmail = (email) => {
    if(email == null) return false;
    return email.match(
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
  };


function check_session(sid) {
    return !(sid in sessions);
}

async function check_credentials(email, psw) {
    let user = await users.findOne({email: email});
    if(user == null) return null;
    if(user.psw == psw)
    {
        return user.userId;
    }
    return null;
}
function generate_session_id(id) {
    let sid = 0;
    do{
        sid = random_bytes(16);
    }while(sid in sessions);

    if(id in alive_session_per_id)
        delete sessions[alive_session_per_id[id]];

    sessions[sid] = {id: id, time: Date.now()};
    alive_session_per_id[id] = sid;
    return sid;
}
async function add_ingredient(id, ingredient, expiration) {
    let st = await storage.findOne({userId: id});
    if(st == null)
    {
        st = {userId: id, ingredients: []};
        await storage.insertOne(st);
    }
    st.ingredients.push({name: ingredient.name, expiration: ingredient.expiration});
    await storage.replaceOne({userId: id}, st);
}
async function get_ingredients(id) {    //ingredients of a user
    let st = await storage.findOne({userId: id});
    if(st == null) return [];
    return st.ingredients;
}
async function get_all_ingredients(){   //all ingredients
    if(ingredients_query == null)
        ingredients_query = await ingredients.find().toArray();
    return ingredients_query;
}
async function get_recipes() {
    if(recipes_query == null)
        recipes_query = await recipes.find().limit(1000).toArray();
    return recipes_query;
}
async function get_possible_recipes(id) {
    let ingredients = await get_ingredients(id);
    let s;
    if(ingredients == null) s = new Set();
    else s = new Set(ingredients.map(t => t.name));
    let recipes = await get_recipes();
    //console.log("recipes", recipes);
    let ret_recipes = []

    for(let i=0;i<recipes.length;i++) {
        let missing = [];
        let cnt = 0;
        let cnt2 = 0;
        for(let j=0;j<recipes[i].ingredients.length;j++)
        {
            let ing = Object.keys(recipes[i].ingredients[j])[0];
            if(!s.has(ing))
            {
                cnt++;
                missing.push(ing);
            }
            else cnt2++;
        }
        ret_recipes.push([recipes[i], missing, cnt, cnt2]);
    }
    ret_recipes = ret_recipes.sort(function(a, b){
        if(a[3] == b[3]) return a[2] - b[2];
        return b[3]-a[3];
    });
    return ret_recipes.slice(0, 10).map((x) => x[0]);
}

async function generate_user_id()
{
    let id = 0;
    while(true)
    {
        id = random_bytes(16);
        let g = await guests.findOne({id: id});
        let u = await users.findOne({userId: id});

        if(g == null && u == null && !(id in sessions)) return id;
    }
}

function check_ingredient(ingredient)
{
    return ingredient.name !== undefined && ingredient.expiration !== undefined && ingredient.quantity !== undefined;
}

app.post('/login', async (req, res) => {
    console.log("/login");
    let id = null;
    let email = req.body.email;
    let psw = req.body.psw;
    id = await check_credentials(email, psw);
    if(id != null)
    {
        let sid = generate_session_id(id);
        res.send({sessionId: sid});
    }
    else
    {
        res.status(400).send("Wrong Credentials");
    }
});

app.post('/register', async (req, res) => {
    console.log("/register");
    let mail = req.body.mail;
    let psw = req.body.psw;
    if(!validateEmail(mail))
    {
        res.status(401).send("email not valid");
        return;
    }
    let id = await generate_user_id();
    let check = await users.findOne({email: mail});
    if(check == null){
        //todo: send verification email
        await users.insertOne({username: req.body.username, psw: psw, email: mail, userId: id});
        res.send("ok")
        return;
    }
    res.status(400).send("email already used");
});

app.post('/add', async (req, res) => {
    console.log("/add");
    let ingredient = req.body.ingredient;
    let sid = req.body.sid;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    if(check_ingredient(ingredient))
    {
        let id = sessions[sid].id;
        await add_ingredient(id, ingredient);
        res.send("ok");
        return;
    }
    res.status(401).send("bad ingredient format");
});

app.delete('/remove', async (req, res) => {
    console.log('/remove');
    let sid = req.body.sid;
    let ingredient = req.body.ingredient;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    let id = sessions[sid].id;
    try{
        let st = await storage.findOne({userId: id});
        if(st == null){
            res.status(400).send("storage not found");
            return;
        }
        let old = st.ingredients.length;
        if (ingredient >= 0 && ingredient < old) {
            st.ingredients.splice(ingredient, 1);
        }
        else{
            res.status(402).send("invalid index");
            return;
        }
        await storage.replaceOne({userId: id}, st);
        let removed = old-st.ingredients.length;
        res.send("removed " + removed.toString() + " elements");
    }
    catch(error)
    {
        console.log(error);
        res.status(401).send("error");
    }
})

app.get('/ingredients', async (req, res) => {
    console.log("/ingredients");
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    let id = sessions[sid].id;
    let ingredients = await get_ingredients(id);
    res.send(ingredients);
});

app.get('/all_ingredients', async (req, res) => {
    console.log("/all_ingredients");
    res.send(await get_all_ingredients())
})

app.get('/recipes', async (req, res) => {
    console.log("/recipes");
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    let id = sessions[sid].id;
    let ret = await get_possible_recipes(id);
    res.send(ret);
});

app.get('/guest_registration', async (req, res) => {
    console.log("/guest_registration");

    let id = await generate_user_id();

    guests.insertOne({id: id, register_date: Date.now()});
    is_guest.add(id);
    sessions[id] = {id: id, time: Date.now()};
    res.send(id.toString());
});

app.delete('/delete_account', async (req, res) => {
    console.log("/delete_account");
    let sid = req.body.sid;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    let uid = sessions[sid].id;
    
    let response = await users.deleteOne({userId: uid});
    
    if(response.deletedCount == 1)
    {
        await storage.deleteOne({userId: uid});
        res.send("ok");
    }
    else res.status(404).send("user not found");
});

app.get("/user", async (req, res) => {
    console.log("/user");
    let sid = req.query.sid;
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }

    if(is_guest.has(sid)) res.send({guest: true, username: "guest"});
    else
    {
        let uid = sessions[sid].id;
        let user = await users.findOne({userId: uid});
        if(user == null)
        {
            res.status(400).send("user not found");
            return;
        }
        res.send({guest: false, username: user.username});
    }
})

app.post('/change_password', async (req, res) => {
    console.log("/change_password");
    let sid = req.body.sid;
    let old_psw = req.body.old_psw;
    let new_psw = req.body.new_psw;
    if(old_psw == new_psw)
    {
        res.status(402).send("the new password is the same as the old one");
        return;
    }
    if(check_session(sid)) {
        res.status(403).send("session not found");
        return;
    }
    let uid = sessions[sid].id;
    try{
        let psw_check = await users.findOne({userId: uid});
        if(old_psw != psw_check.psw)
        {
            res.status(405).send("old password does not correspond");
            return;
        }
        await users.updateOne({ userId: uid }, {$set:{psw: new_psw}});
        res.send("ok");
    }
    catch (error) 
    {
        console.error(error);
        res.status(404).send("user not found");
    }
});


export default {app, connect};