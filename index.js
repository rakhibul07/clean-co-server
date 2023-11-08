const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

//parsers
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

//DB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.guvzu32.mongodb.net/clean-co?retryWrites=true&w=majority`;

//mongodb connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const servicesCollection = client.db("clean-co").collection("services");
    const bookingCollection = client.db("clean-co").collection("bookings");

    //middlewares
    //grant access
    const gateman = (req, res, next) => {
      const { token } = req.cookies;
      if (!token) {
        return res.status(401).send({ message: "unauthorized" });
      }

      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        function (error, decoded) {
          if (error) {
            return res.status(401).send({ message: "unauthorized " });
          }
          req.user = decoded;
          next();
        }
      );
    };

    // await client.connect();

    //filter api //http://localhost:5000/api/v1/services?category=Household

    //sort api
    app.get("/api/v1/services", gateman, async (req, res) => {
      let queryObj = {};
      let sortObj = {};
      const category = req.query.category;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      if (category) {
        queryObj.category = category;
      }

      if (sortField && sortOrder) {
        sortObj[sortField] = sortOrder;
      }
      const cursor = servicesCollection
        .find(queryObj)
        .limit(limit)
        .skip(skip)
        .sort(sortObj);
      const result = await cursor.toArray();

      //total services
      const totalServices = await servicesCollection.countDocuments();
      res.send({ totalServices, result });
    });

    app.post("/api/v1/user/create-booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //user specific bookings
    app.get("/api/v1/user/bookings", gateman, async (req, res) => {
      const queryEmail = req.query.email;
      const tokenEmail = req.user.email;

      if (queryEmail !== tokenEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (queryEmail) {
        query.email = queryEmail;
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/api/v1/user/cancel-booking/:bookingId", async (req, res) => {
      const id = req.params.bookingId;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    //jwt
    app.post("/api/v1/auth/access-token", async (req, res) => {
      //create token and send to client
      const user = req.body;
      console.log(req.body);

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!!!");
});

app.listen(port, () => {
  console.log(`Clean co running on port http://localhost:${port}`);
});
