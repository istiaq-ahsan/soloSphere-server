const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1pvay.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const jobsCollection = client.db("soloSphereDB").collection("jobs");
    const bidsCollection = client.db("soloSphereDB").collection("bids");

    app.post('/add-job', async (req, res) => {
      const jobData = req.body

      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    })

    app.get('/jobs', async (req, res) => {
      const result = await jobsCollection.find().toArray()
      res.send(result);
    })

    app.get('/jobs/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'buyer.email': email }
      const result = await jobsCollection.find(query).toArray()
      res.send(result);
    })

    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.deleteOne(query)
      res.send(result);
    })

    app.get('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query)
      res.send(result);
    })

    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id;
      const jobData = req.body
      const updated = {
        $set: jobData,
      }
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const result = await jobsCollection.updateOne(query, updated, options);
      res.send(result);
    })

    app.post('/add-bid', async (req, res) => {
      const bidData = req.body

      const query = { email: bidData.email, jobId: bidData.jobId }
      const alreadyExist = await bidsCollection.findOne(query)
      if (alreadyExist) return res.status(400).send('you have already bid this job')

      const result = await bidsCollection.insertOne(bidData);

      const filter = { _id: new ObjectId(bidData.jobId) }
      const update = {
        $inc: { bid_count: 1 },
      }
      const updateBidCount = await jobsCollection.updateOne(filter, update)

      res.send(result);
    })

    app.get('/bids/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email }
      const result = await bidsCollection.find(query).toArray()
      res.send(result);
    })


    app.get('/bid-requests/:email', async (req, res) => {
      const email = req.params.email;
      const query = { buyer: email }
      const result = await bidsCollection.find(query).toArray()
      res.send(result);
    })

    app.patch('/bid-status-update/:id', async (req, res) => {
      const { status } = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { status },
      }
      const result = await bidsCollection.updateOne(filter, updated)
      res.send(result);
    })

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
