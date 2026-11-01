import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.DB_URI);
let booksCollection;
let borrowsCollection;

const CATEGORIES = ['Fiction', 'Science', 'History', 'Kids', 'Others'];

// ---------- JWT middleware ----------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized: token pawa jayni' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden: token valid na ba expire hoye geche' });
    }
    // email sob somoy token theke, body theke kokhono na
    req.user = { email: decoded.email, name: decoded.name };
    next();
  });
};

// ?email= thakle JWT lagbe, na thakle public
const requireAuthIfEmail = (req, res, next) =>
  req.query.email ? verifyToken(req, res, next) : next();

const isValidId = (id) => ObjectId.isValid(id);

// ---------- Root ----------
app.get('/', (req, res) => {
  res.send('BookNook server is running...');
});

// ---------- Books ----------

// GET /books : public
// ?sort=latest&limit=6  -> Home New Arrivals
// ?email=me@mail.com    -> My Books (JWT lagbe, nijer email hote hobe)
app.get('/books', requireAuthIfEmail, async (req, res) => {
  try {
    const { sort, limit, email } = req.query;
    const filter = {};

    if (email) {
      if (email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden: onner boi dekha jabe na' });
      }
      filter.userEmail = email;
    }

    let cursor = booksCollection.find(filter);
    if (sort === 'latest') cursor = cursor.sort({ createdAt: -1 });
    const n = parseInt(limit, 10);
    if (n > 0) cursor = cursor.limit(n);

    res.send(await cursor.toArray());
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Books load korte problem hoyeche' });
  }
});

// GET /books/:id : JWT
app.get('/books/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book pawa jayni' });
    res.send(book);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Book load korte problem hoyeche' });
  }
});

// POST /books : JWT
app.post('/books', verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, totalCopies } = req.body;
    const copies = Number(totalCopies);

    if (!title?.trim() || !author?.trim() || !image?.trim() || !description?.trim()) {
      return res.status(400).send({ message: 'Shob field puron koro' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).send({ message: 'Category valid na' });
    }
    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).send({ message: 'Total copies kombe kom 1 hote hobe' });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      totalCopies: copies,
      availableCopies: copies,
      userName: req.user.name,
      userEmail: req.user.email,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Book add korte problem hoyeche' });
  }
});

// PATCH /books/:id : JWT + sudhu owner
app.patch('/books/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book pawa jayni' });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'Tumi sudhu nijer boi edit korte parbe' });
    }

    const { title, author, category, image, description, totalCopies } = req.body;
    const updates = {};
    if (title?.trim()) updates.title = title.trim();
    if (author?.trim()) updates.author = author.trim();
    if (image?.trim()) updates.image = image.trim();
    if (description?.trim()) updates.description = description.trim();
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).send({ message: 'Category valid na' });
      }
      updates.category = category;
    }

    if (totalCopies !== undefined) {
      const newTotal = Number(totalCopies);
      const borrowed = book.totalCopies - book.availableCopies;
      if (!Number.isInteger(newTotal) || newTotal < 1) {
        return res.status(400).send({ message: 'Total copies kombe kom 1 hote hobe' });
      }
      if (newTotal < borrowed) {
        return res.status(400).send({
          message: `Ekhon ${borrowed} ta copy borrow kora ache, tai total ${borrowed} er niche namano jabe na`,
        });
      }
      updates.totalCopies = newTotal;
      updates.availableCopies = newTotal - borrowed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'Update korar moto kichu pawa jayni' });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Book update korte problem hoyeche' });
  }
});

// DELETE /books/:id : JWT + sudhu owner
app.delete('/books/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book pawa jayni' });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'Tumi sudhu nijer boi delete korte parbe' });
    }

    // kew borrow kore thakle delete block
    const activeBorrows = await borrowsCollection.countDocuments({ bookId: id });
    if (activeBorrows > 0) {
      return res.status(409).send({
        message: 'Ei boi ekhon kew borrow kore ache, tai delete kora jabe na',
      });
    }

    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Book delete korte problem hoyeche' });
  }
});

// ---------- Borrows ----------

// POST /borrows : JWT
app.post('/borrows', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId || !isValidId(bookId)) {
      return res.status(400).send({ message: 'Invalid book id' });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) return res.status(404).send({ message: 'Book pawa jayni' });

    // No double borrow
    const already = await borrowsCollection.findOne({
      bookId,
      userEmail: req.user.email,
    });
    if (already) {
      return res.status(409).send({ message: 'Tumi ei boi ta already borrow korecho' });
    }

    // Copies 1 komano (sudhu jodi availableCopies > 0 hoy)
    const updated = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(bookId), availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(400).send({ message: 'Not Available: kono copy baki nei' });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 din

    const borrow = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: req.user.email,
      userName: req.user.name,
      borrowDate,
      returnDate,
    };

    try {
      const result = await borrowsCollection.insertOne(borrow);
      res.status(201).send(result);
    } catch (insertErr) {
      // borrow save na hole copy ferot dao
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { availableCopies: 1 } }
      );
      throw insertErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Borrow korte problem hoyeche' });
  }
});

// GET /borrows : JWT, sudhu nijer borrow
app.get('/borrows', verifyToken, async (req, res) => {
  try {
    const result = await borrowsCollection
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Borrow list load korte problem hoyeche' });
  }
});

// DELETE /borrows/:id : JWT, return book
app.delete('/borrows/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid borrow id' });

    const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
    if (!borrow) return res.status(404).send({ message: 'Borrow record pawa jayni' });
    if (borrow.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'Eta tomar borrow na' });
    }

    await borrowsCollection.deleteOne({ _id: new ObjectId(id) });
    await booksCollection.updateOne(
      { _id: new ObjectId(borrow.bookId) },
      { $inc: { availableCopies: 1 } }
    );

    res.send({ message: 'Boi ferot deya hoyeche' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Return korte problem hoyeche' });
  }
});

// ---------- Start ----------
async function start() {
  try {
    await client.connect();
    const db = client.db('booknookDB');
    booksCollection = db.collection('books');
    borrowsCollection = db.collection('borrows');
    console.log('MongoDB connected!');

    app.listen(port, () => console.log(`BookNook server running on port ${port}`));
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
}

start();