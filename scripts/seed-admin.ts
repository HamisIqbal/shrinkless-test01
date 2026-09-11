import { hash } from '@node-rs/argon2';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { User } from '@/lib/db/models/user';

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npm run seed:admin -- <email> <password>');
    process.exit(1);
  }

  await connectToDatabase();

  const passwordHash = await hash(password);
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { passwordHash, role: 'admin' }, $setOnInsert: { email: email.toLowerCase() } },
    { upsert: true, returnDocument: 'after' },
  );

  console.log(`admin ready: ${email}`);
  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
