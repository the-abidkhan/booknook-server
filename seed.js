import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.DB_URI;
if (!uri) {
  console.error('DB_URI .env file e nai!');
  process.exit(1);
}

const COPIES = 5; // prottek boi er copy sonkha

// [title, author, description]
const catalog = {
  Fiction: [
    ['1984', 'George Orwell', 'A chilling story of surveillance and control in a totalitarian state, where even private thoughts are policed.'],
    ['Pride and Prejudice', 'Jane Austen', 'Elizabeth Bennet and Mr. Darcy navigate pride, class and first impressions in Regency England.'],
    ['The Great Gatsby', 'F. Scott Fitzgerald', 'A mysterious millionaire chases a lost love in the glittering and hollow Jazz Age.'],
    ['To Kill a Mockingbird', 'Harper Lee', 'Scout Finch watches her father defend an innocent man in a deeply prejudiced Southern town.'],
    ['The Alchemist', 'Paulo Coelho', 'A young shepherd travels from Spain to Egypt in search of treasure and his personal legend.'],
    ['The Kite Runner', 'Khaled Hosseini', 'A story of friendship, guilt and redemption set against the changing face of Afghanistan.'],
    ['Brave New World', 'Aldous Huxley', 'A future society trades freedom for comfort, stability and engineered happiness.'],
    ['Life of Pi', 'Yann Martel', 'A boy survives 227 days on a lifeboat in the Pacific with a Bengal tiger for company.'],
    ['The Book Thief', 'Markus Zusak', 'Narrated by Death, this is the story of a girl who steals books in Nazi Germany.'],
    ['Wuthering Heights', 'Emily Bronte', 'A stormy tale of obsessive love and revenge on the Yorkshire moors.'],
  ],
  Science: [
    ['A Brief History of Time', 'Stephen Hawking', 'From the Big Bang to black holes, a clear tour of the universe for curious general readers.'],
    ['Cosmos', 'Carl Sagan', 'A beautiful journey through space and time that explores how science shapes our view of the universe.'],
    ['The Selfish Gene', 'Richard Dawkins', 'A landmark book that explains evolution from the point of view of the gene.'],
    ['Silent Spring', 'Rachel Carson', 'The classic that exposed the damage caused by pesticides and sparked the modern environmental movement.'],
    ['On the Origin of Species', 'Charles Darwin', 'Darwin lays out the theory of natural selection that changed biology forever.'],
    ['Astrophysics for People in a Hurry', 'Neil deGrasse Tyson', 'The big ideas of the cosmos explained in short, easy chapters.'],
    ['The Gene: An Intimate History', 'Siddhartha Mukherjee', 'The story of the gene, from Mendel in the garden to the age of genetic engineering.'],
    ["Surely You're Joking, Mr. Feynman!", 'Richard Feynman', 'Funny and curious stories from the life of a Nobel-winning physicist.'],
    ['The Immortal Life of Henrietta Lacks', 'Rebecca Skloot', "How one woman's cells transformed medicine, and the family that never knew."],
    ['The Elegant Universe', 'Brian Greene', 'A readable introduction to string theory and the search for a theory of everything.'],
  ],
  History: [
    ['Sapiens', 'Yuval Noah Harari', 'A sweeping history of humankind, from early foragers to the digital age.'],
    ['Guns, Germs, and Steel', 'Jared Diamond', 'Why some societies grew powerful while others did not, explained through geography and biology.'],
    ['The Diary of a Young Girl', 'Anne Frank', 'The true diary of a Jewish teenager hiding from the Nazis in Amsterdam.'],
    ['SPQR', 'Mary Beard', 'A fresh look at the rise of ancient Rome and the people who built it.'],
    ['The Discovery of India', 'Jawaharlal Nehru', 'A reflection on the long history, culture and heritage of the Indian subcontinent.'],
    ["A People's History of the United States", 'Howard Zinn', 'American history told from the view of workers, women and ordinary people.'],
    ['The Silk Roads', 'Peter Frankopan', 'World history retold through the great trade routes that connected East and West.'],
    ['Genghis Khan and the Making of the Modern World', 'Jack Weatherford', 'How the Mongol leader reshaped trade, law and communication across continents.'],
    ['The Rise and Fall of the Third Reich', 'William L. Shirer', 'A detailed account of Nazi Germany drawn from captured documents and eyewitness reports.'],
    ['The Guns of August', 'Barbara W. Tuchman', 'A gripping account of the first month of World War I and the decisions that led to it.'],
  ],
  Kids: [
    ["Charlotte's Web", 'E. B. White', 'A clever spider saves her friend Wilbur the pig in this timeless tale of friendship.'],
    ['Matilda', 'Roald Dahl', 'A gifted girl uses her mind and a little magic to stand up to unkind grown-ups.'],
    ['The Gruffalo', 'Julia Donaldson', 'A quick-thinking mouse invents a monster to escape the hungry creatures of the forest.'],
    ['Where the Wild Things Are', 'Maurice Sendak', 'Max sails to an island of wild creatures and becomes their king.'],
    ['The Very Hungry Caterpillar', 'Eric Carle', 'A tiny caterpillar eats his way through the week and turns into a beautiful butterfly.'],
    ["Harry Potter and the Sorcerer's Stone", 'J. K. Rowling', 'An orphan discovers he is a wizard and begins his first year at Hogwarts.'],
    ['The Lion, the Witch and the Wardrobe', 'C. S. Lewis', 'Four siblings step through a wardrobe into the magical land of Narnia.'],
    ['Charlie and the Chocolate Factory', 'Roald Dahl', "Charlie wins a golden ticket to Willy Wonka's amazing and strange chocolate factory."],
    ['The Little Prince', 'Antoine de Saint-Exupery', 'A gentle story about a prince from a tiny planet and what really matters in life.'],
    ['Winnie-the-Pooh', 'A. A. Milne', 'Gentle adventures of a bear of very little brain and his friends in the Hundred Acre Wood.'],
  ],
  Others: [
    ['Atomic Habits', 'James Clear', 'A practical guide to building good habits and breaking bad ones through tiny daily changes.'],
    ['Deep Work', 'Cal Newport', 'Rules for focused success in a world full of distraction.'],
    ['The Pragmatic Programmer', 'Andrew Hunt and David Thomas', 'Timeless advice for software developers who want to write better code and grow their craft.'],
    ["Man's Search for Meaning", 'Viktor Frankl', 'A psychiatrist reflects on survival in concentration camps and the human need for purpose.'],
    ['Rich Dad Poor Dad', 'Robert Kiyosaki', 'Two views on money that challenge how you think about work, assets and wealth.'],
    ['The 7 Habits of Highly Effective People', 'Stephen R. Covey', 'Seven principles for personal and professional effectiveness.'],
    ['Clean Code', 'Robert C. Martin', 'A handbook of agile software craftsmanship with practical examples of cleaner code.'],
    ['The Psychology of Money', 'Morgan Housel', 'Short stories about how behavior, not intelligence, shapes our financial lives.'],
    ['Ikigai', 'Hector Garcia and Francesc Miralles', 'The Japanese secret to a long and happy life through finding your reason for being.'],
    ['Think and Grow Rich', 'Napoleon Hill', 'A classic on mindset and the principles behind personal achievement.'],
  ],
};

const DAY = 24 * 60 * 60 * 1000;
const owner = { userName: 'BookNook Admin', userEmail: 'admin@booknook.com' };

const generateBooks = () => {
  const categories = Object.keys(catalog);
  const books = [];
  let n = 0;

  // round-robin: Fiction, Science, History, Kids, Others, Fiction, ...
  // jate newest 6 book e alada alada category thake
  for (let round = 0; round < 10; round++) {
    for (const category of categories) {
      const [title, author, description] = catalog[category][round];
      books.push({
        title,
        author,
        category,
        image: `https://picsum.photos/seed/booknook${n + 1}/300/400`,
        description,
        totalCopies: COPIES,
        availableCopies: COPIES,
        ...owner,
        createdAt: new Date(Date.now() - n * DAY), // protiti boi alada din
      });
      n++;
    }
  }
  return books;
};

const seedDB = async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Database connected!');

    const books = client.db('booknookDB').collection('books');
    await books.deleteMany({});
    const result = await books.insertMany(generateBooks());
    console.log(`${result.insertedCount} ta english book add hoyeche (10 ta kore 5 category, ${COPIES} copy kore).`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
};

seedDB();