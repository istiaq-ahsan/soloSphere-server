const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const port = process.env.PORT || 9000
const app = express()

const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1pvay.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  if (!token) {
    return res.send(401).send({ message: 'unauthorized' })
  }
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.send(401).send({ message: 'unauthorized' })
    }
    req.user = decoded
  })
  next();
}


async function run() {
  try {
    const jobsCollection = client.db("soloSphereDB").collection("jobs");
    const bidsCollection = client.db("soloSphereDB").collection("bids");

    app.post('/jwt', async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '365d' })
      console.log(token);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
        .send({ success: true })
    })

    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
        .send({ success: true })
    })

    app.post('/add-job', async (req, res) => {
      const jobData = req.body

      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    })

    app.get('/jobs', async (req, res) => {
      const result = await jobsCollection.find().toArray()
      res.send(result);
    })

    app.get('/jobs/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email
      // console.log('email from token-->', decodedEmail)
      // console.log('email from params-->', email)
      if (decodedEmail !== email)
        return res.status(401).send({ message: 'unauthorized access' })
      const query = { 'buyer.email': email }
      const result = await jobsCollection.find(query).toArray()
      res.send(result);
    })

    app.delete('/job/:id', verifyToken, async (req, res) => {
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

    app.get('/bids/:email', verifyToken, async (req, res) => {
      const isBuyer = req.query.buyer
      const email = req.params.email
      const decodedEmail = req.user?.email
      // console.log('email from token-->', decodedEmail)
      // console.log('email from params-->', email)
      if (decodedEmail !== email)
        return res.status(401).send({ message: 'unauthorized access' })

      let query = {}
      if (isBuyer) {
        query.buyer = email
      } else {
        query.email = email
      }

      const result = await bidsCollection.find(query).toArray()
      res.send(result)
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

    app.get('/all-jobs', async (req, res) => {
      const filter = req.query.filter
      const search = req.query.search
      const sort = req.query.sort

      let options = {}

      if (sort) options = { sort: { deadline: sort === 'asc' ? 1 : -1 } }

      let query = {
        title: {
          $regex: search,
          $options: 'i',
        }
      }
      if (filter) query.category = filter
      const result = await jobsCollection.find(query, options).toArray()
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
