const express = require("express");
const cors = require("cors");
const {connectToMongoDB} = require("./db.js");
const {ObjectId} = require("mongodb");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());

let db;

async function main (){
    try {
        db = await connectToMongoDB();
    } catch (error){
        console.error("Error connecting to MongoDB in main", error);
    }
}

main();

app.get("/", async (req, res)=>{
    try{
        let fetchedArticles = await db.collection("articles").find({}).toArray();
        
        let fetchedTags;
        try {
            fetchedTags = await db.collection("tags").find({}).toArray();
        } catch (error) {
            res.status(500).json({"error":"Error fetching tags", "error": error.message})
        }

        for (let article of fetchedArticles){
            let tagNameHolder = [];
            for (let articleTagId of article.tags){
                for (let tag of fetchedTags){
                    if(tag._id == articleTagId){
                        tagNameHolder.push(tag.name);                        
                    }
                }
            }
            article.tags = tagNameHolder;
        }
        
        res.status(200).json(fetchedArticles);

    } catch (error){
        res.status(500).json({"error":"Error fetching articles", "error": error.message})
    }
})

app.get("/article/:id", async(req,res)=>{
    try {
        const targetId = new ObjectId(req.params.id);
        const fetchedArticle = await db.collection("articles").findOne({_id: targetId});
        console.log("fetched article here", fetchedArticle)
        if (fetchedArticle && Object.keys(fetchedArticle).length !== 0){
            res.json(fetchedArticle);
        } else {
            res.status(404).json({message:"No matching article"});
        }
    } catch (error) {
        res.status(500).json({"message":"Error fetching article", "error": error.message})
    }
})
 
app.get("/filter", async(req,res)=>{
    try{

        const criteria = {};

        console.log("req.query", req.query)
        console.log("req query date", req.query.date)

        // support multiple query on date in same query string
        let query = req.query.date
        if (!Array.isArray(req.query.date)){
            query = [req.query.date]
        }

        if(req.query.date){
            criteria.date = {
                "$in":query
            }
        }

        // match based on case insensitive letters;
        if (req.query.source) {
            criteria.source = {
                "$regex": req.query.source,
                "$options":"i"
            }
        }


        if (req.query.authors) {
            console.log("inside here", req.query.authors)
            criteria.authors = {
                "$in":[req.query.authors]
            }
        }

        const results = await db.collection("articles").find(criteria).toArray();

        res.json({
            "filtered": results
        })

    } catch (error){
        res.status(500).json({"error": error.message});
    }
})

app.post("/article", async(req,res)=>{
    try{
        const {title, source, date, credibility_score, news_type, tags, authors} = req.body;
        if (!title || !source || !date || !credibility_score || !news_type || !tags || tags.length == 0 || !authors) {
            res.status(400).json({"error":"Missing fields in req body"})
        }
        const newArticle = {title, source, date, credibility_score, news_type, tags, authors}
        const result = await db.collection("articles").insertOne(newArticle);
        console.log("code works here?")
        res.status(202).json(result);
    } catch (error){
        res.status(500).json({"error":"Error adding article", "error": error.message})
    }
})

app.put("/article/:id", async(req,res)=>{
    try{
        const targetId = new ObjectId(req.params.id);
        const {title, source, date, credibility_score, news_type, tags, authors} = req.body;
        if (!title || !source || !date || !credibility_score || !news_type || !tags || tags.length == 0 || !authors) {
            res.status(400).json({"error":"Missing fields in req body"})
        }

        const updatedEntry = {title, source, date, credibility_score, news_type, tags, authors};
        const result = await db.collection("articles").updateOne(
            {_id:targetId},
            {$set: updatedEntry}
        )

        if(result.modifiedCount === 0){
            return res.status(404).json("No article found by id or no modifications made");
        }
        res.status(201).json({"message":"Updated the article"});

    } catch (error){
        res.status(500).json({"error":"Unable to update entry"});
    }
})

app.patch("/article/changetags/:id", async(req,res)=>{
    try{
        const targetId = new ObjectId(req.params.id);
        const {tags} = req.body;
        if (!tags || tags.length == 0) {
            res.status(400).json({"error":"Missing fields in req body"})
        }

        const updatedEntry = {tags};
        console.log("tags here in patch", tags)
        const result = await db.collection("articles").updateOne(
            {_id:targetId},
            {$set: updatedEntry}
        )

        if(result.modifiedCount === 0){
            return res.status(404).json("No article found by id or no tags changed made");
        }
        res.status(201).json({"message":"Updated the article with new list of tags"});

    } catch (error){
        res.status(500).json({"error":"Unable to update entry"});
    }
})

app.delete("/article/delete/404cdd7bc109c432f8cc2443b45bcfe95980f5107215c645236e577929ac3e52/:id", async(req,res)=>{
    try{
        const targetId = new ObjectId(req.params.id);
        
        const result = await db.collection("articles").deleteOne(
            {_id:targetId},
        )
        console.log("result her", result)
        res.json({"message":result});
    } catch (error){
        res.status(500).json({"error":"Unable to delete entry"});
    }
})

app.post("/users", async function(req,res){
    
    const result = await db.collection("users").insertOne(
        {
            "email": req.body.email,
            "password": await bcrypt.hash(req.body.password, 12)
        }
    )
    res.json({
        "message": "Success",
        "result": result
    })
})



// JWT
const JWT = require("jsonwebtoken");

const generateAccessToken = (id, email) => {
    return JWT.sign({
                "user_id": id,
                "email": email
        },
        process.env.TOKEN_SECRET,
        {expiresIn:"1h"}
    )    
}

let jwtStorage = {}

app.post("/login", async(req,res)=>{
    
    const {email, password} = req.body;
    if(!email || !password){
        return res.status(400).json({"message":"Email and password are required"});
    }
    
    const user = await db.collection("users").findOne({email:email});
    if(!user){
        return res.status(404).json({"message":"User not found"});
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid){
        return res.status(401).json({"message":"Invalid password"});
    }

    const accessToken = generateAccessToken(user._id, user.email);
    jwtStorage["access_token"] = accessToken;
    console.log("storage here", jwtStorage);
    res.json({accessToken: accessToken});
})

const verifyToken = (req, res, next) => {

    console.log("verify token here", jwtStorage["access_token"])
    req.headers["authorization"] = jwtStorage["access_token"]

    const authHeader = req.headers["authorization"];
    const token = authHeader;
    if (!token) {
        return res.sendStatus(403);
    }
    JWT.verify(token, process.env.TOKEN_SECRET, (err,user)=>{
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    })
}

app.use((req, res, next)=>{
    console.log(`${req.method} ${req.url}`);
    next();
})

app.use((req, res, next)=>{
    console.log(`Response status: ${res.statusCode}`);
    next();
})

app.get("/profile", verifyToken, (req,res)=>{
    console.log("route hit in profile")
    res.json({"message":"you have reached protected route"});
})

// can update one nested item, use elemMatch, and then $ in the checkups.$.name to indicate the matched Element
// `
// db.animals.updateOne({
//     '_id': ObjectId('65ea80c7a0700b9fc5d061c9'),
//     'checkups': {
//         '$elemMatch": {
//             '_id': ObjectId('65ea8b10a0700b9fc5d061d1')
//         }
//     }
// }, {
//     "$set": {
//         "checkups.$.name":"Dr. Su"
//     }
// })
// `

const port = 3000;
app.listen(port, ()=>{
    console.log(`server is running on port ${port}`);
})
