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




const port = 3000;
app.listen(port, ()=>{
    console.log(`server is running on port ${port}`);
})