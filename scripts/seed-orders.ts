import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';

const ADDRESS = {
  name: 'A Buyer', line1: '1 Main St', line2: '', city: 'Austin',
  state: 'TX', postalCode: '78701', country: 'US', phone: '',
};

const ITEMS = [{
  title: 'Field Tee', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
  unitPriceCents: 4200, quantity: 2, imagePublicId: '',
}];

async function main() {
  await connectToDatabase();

  for (const [index, status] of ['pending', 'paid', 'shipped'].entries()) {
    const orderNumber = `SL-90${index}`;

    await Order.findOneAndUpdate(
      { orderNumber },
      {
        $set: {
          email: 'buyer@example.com', items: ITEMS, shippingAddress: ADDRESS,
          subtotalCents: 8400, shippingCents: 500, taxCents: 0, totalCents: 8900,
          status,
        },
        $setOnInsert: { orderNumber },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    console.log(`seeded ${orderNumber} (${status})`);
  }

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
