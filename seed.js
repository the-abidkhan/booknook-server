import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// .env file theke DB_URI load kora hocche ebong URL- er sathe database nam 'booknookDB' fix kore dewa holo
const getMongoUri = () => {
  const uri = process.env.DB_URI || process.env.MONGO_URI;
  if (!uri) return 'mongodb://localhost:27017/booknookDB';
  
  // Jodi uri-te database name na thake ba change korte hoy, tahole /booknookDB add kore nibe
  if (uri.includes('?')) {
    const parts = uri.split('?');
    if (!parts[0].endsWith('/booknookDB') && !parts[0].endsWith('/booknook')) {
      return `${parts[0].replace(/\/$/, '')}/booknookDB?${parts[1]}`;
    }
  } else {
    if (!uri.endsWith('/booknookDB') && !uri.endsWith('/booknook')) {
      return `${uri.replace(/\/$/, '')}/booknookDB`;
    }
  }
  return uri;
};

const MONGO_URI = getMongoUri();

// Book Schema
const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  category: String,
  image: String,
  description: String,
  copies: Number,
  createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', bookSchema);

// 50ti dummy boi generate korar function
const generateBooks = () => {
  const categories = ['Fiction', 'Science', 'History', 'Kids', 'Others'];
  const books = [];

  for (let i = 1; i <= 50; i++) {
    books.push({
      title: `Book Title ${i}`,
      author: `Author Name ${i}`,
      category: categories[i % categories.length],
      image: `https://picsum.photos/seed/book${i}/300/400`,
      description: `This is a short description for Book ${i}. A wonderful read for library users.`,
      copies: Math.floor(Math.random() * 5) + 1 // 1 theke 5 ti copy
    });
  }
  return books;
};

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Database connected successfully!');

    // ager sob boi muche fela hocche
    await Book.deleteMany({});
    console.log('Old books cleared.');

    const sampleBooks = generateBooks();
    await Book.insertMany(sampleBooks);
    console.log('Successfully added 50 books to the database!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

seedDB();