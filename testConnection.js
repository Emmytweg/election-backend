// testConnection.js
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://ayanfetweg:emmy001@cluster2.ij6c7u4.mongodb.net/?retryWrites=true&w=majority&appName=cluster2";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
