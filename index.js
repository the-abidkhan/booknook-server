import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Root API
app.get('/', (req, res) => {
  res.send('BookNook server is running...');
});

// MongoDB Connection URI
const uri = process.env.DB_URI;

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();

    // Database & Collections
    const bookCollection = client.db("booknookDB").collection("books");

    // GET /books - Fetch all books
    app.get('/books', async (req, res) => {
      try {
        const cursor = bookCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch books", error });
      }
    });

    // GET /books/:id - Fetch single book by ID
    app.get('/books/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Book not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID format or server error" });
      }
    });

    // POST /books - Add a new book
    app.post('/books', async (req, res) => {
      try {
        const newBook = req.body;
        const result = await bookCollection.insertOne(newBook);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add book", error });
      }
    });

    // DELETE /books/:id - Delete a single book by ID
    app.delete('/books/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Book not found to delete" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete book", error });
      }
    });

    // PUT /books/:id - Update a book by ID
    app.put('/books/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            ...updatedData
          }
        };

        const result = await bookCollection.updateOne(filter, updatedDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Book not found to update" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update book", error });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } catch (error) {
    console.dir(error);
  }
}
run();

app.listen(port, () => {
  console.log(`BookNook server is running on port ${port}`);
});