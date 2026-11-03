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
let connecting;

const CATEGORIES = ['Fiction', 'Science', 'History', 'Kids', 'Others'];

async function connectDB() {
  if (!connecting) {
    connecting = client.connect().then(() => {
      const db = client.db('booknookDB');
      booksCollection = db.collection('books');
      borrowsCollection = db.collection('borrows');
      console.log('MongoDB connected!');
    });
  }
  return connecting;
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.status(500).send({ message: 'Could not connect to the database' });
  }
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized: please login first' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // TEMP DEBUG: 403 fix hole ei duita line theke err.message soriye dio
      console.error('JWT error:', err.message);
      return res
        .status(403)
        .send({ message: `Session expired (${err.message}). Please login again` });
    }
    req.user = { email: decoded.email, name: decoded.name };
    next();
  });
};

const requireAuthIfEmail = (req, res, next) =>
  req.query.email ? verifyToken(req, res, next) : next();

const isValidId = (id) => ObjectId.isValid(id);

app.get('/', (req, res) => {
  res.send('BookNook server is running...');
});

app.get('/books', requireAuthIfEmail, async (req, res) => {
  try {
    const { sort, limit, email } = req.query;
    const filter = {};

    if (email) {
      if (email !== req.user.email) {
        return res.status(403).send({ message: 'You can only view your own books' });
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
    res.status(500).send({ message: 'Could not load books' });
  }
});

app.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book not found' });
    res.send(book);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not load the book' });
  }
});

app.post('/books', verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, totalCopies } = req.body;
    const copies = Number(totalCopies);

    if (!title?.trim() || !author?.trim() || !image?.trim() || !description?.trim()) {
      return res.status(400).send({ message: 'Please fill in all fields' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).send({ message: 'Invalid category' });
    }
    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).send({ message: 'Total copies must be at least 1' });
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
    res.status(500).send({ message: 'Could not add the book' });
  }
});

app.patch('/books/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book not found' });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'You can only edit your own books' });
    }

    const { title, author, category, image, description, totalCopies } = req.body;
    const updates = {};
    if (title?.trim()) updates.title = title.trim();
    if (author?.trim()) updates.author = author.trim();
    if (image?.trim()) updates.image = image.trim();
    if (description?.trim()) updates.description = description.trim();
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).send({ message: 'Invalid category' });
      }
      updates.category = category;
    }

    if (totalCopies !== undefined) {
      const newTotal = Number(totalCopies);
      const borrowed = book.totalCopies - book.availableCopies;
      if (!Number.isInteger(newTotal) || newTotal < 1) {
        return res.status(400).send({ message: 'Total copies must be at least 1' });
      }
      if (newTotal < borrowed) {
        return res.status(400).send({
          message: `${borrowed} copies are currently borrowed, so total copies cannot go below ${borrowed}`,
        });
      }
      updates.totalCopies = newTotal;
      updates.availableCopies = newTotal - borrowed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'Nothing to update' });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not update the book' });
  }
});

app.delete('/books/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid book id' });

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book not found' });
    if (book.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'You can only delete your own books' });
    }

    const activeBorrows = await borrowsCollection.countDocuments({ bookId: id });
    if (activeBorrows > 0) {
      return res.status(409).send({
        message: 'This book is currently borrowed, so it cannot be deleted',
      });
    }

    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not delete the book' });
  }
});

app.post('/borrows', verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId || !isValidId(bookId)) {
      return res.status(400).send({ message: 'Invalid book id' });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) return res.status(404).send({ message: 'Book not found' });

    const already = await borrowsCollection.findOne({
      bookId,
      userEmail: req.user.email,
    });
    if (already) {
      return res.status(409).send({ message: 'You have already borrowed this book' });
    }

    const updated = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(bookId), availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return res.status(400).send({ message: 'Not Available: no copies left' });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate.getTime() + 7 * 24 * 60 * 60 * 1000);

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
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { availableCopies: 1 } }
      );
      throw insertErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not borrow the book' });
  }
});

app.get('/borrows', verifyToken, async (req, res) => {
  try {
    const result = await borrowsCollection
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not load your borrows' });
  }
});

app.delete('/borrows/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).send({ message: 'Invalid borrow id' });

    const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
    if (!borrow) return res.status(404).send({ message: 'Borrow record not found' });
    if (borrow.userEmail !== req.user.email) {
      return res.status(403).send({ message: 'This borrow does not belong to you' });
    }

    await borrowsCollection.deleteOne({ _id: new ObjectId(id) });
    await booksCollection.updateOne(
      { _id: new ObjectId(borrow.bookId) },
      { $inc: { availableCopies: 1 } }
    );

    res.send({ message: 'Book returned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Could not return the book' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  connectDB()
    .then(() => app.listen(port, () => console.log(`BookNook server running on port ${port}`)))
    .catch((err) => {
      console.error('DB connection failed:', err.message);
      process.exit(1);
    });
}

export default app;