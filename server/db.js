const {MongoClient} = require("mongodb");
require("dotenv").config();

async function connectToMongoDB(){

    const uri = process.env.MONGO_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB");
        return client.db(process.env.DB_NAME)
    } catch (error){
        console.error("Error connecting to MongoDB");
        throw error;
    }
}


module.exports = {connectToMongoDB}