import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Package } from '../models/Package';
import { Faq } from '../models/Faq';
import { Setting } from '../models/Setting';
import { Wallet } from '../models/Wallet';
import { env } from '../config/env';
import { generateApiKey, generateReferralCode, generateSecretKey } from '../utils/helpers';
import { reconcileLegacyPendingWithdrawals } from './withdrawalService';

const networks = ['MTN', 'Telecel', 'AirtelTigo'] as const;
const bundles = ['1GB', '2GB', '3GB', '4GB', '5GB', '6GB', '8GB', '10GB', '15GB', '20GB', '25GB', '30GB', '40GB', '50GB'];

const bundlePrices: Record<string, number> = {
  '1GB': 4.5, '2GB': 9.0, '3GB': 13.0, '4GB': 17.0, '5GB': 21.0,
  '6GB': 25.0, '8GB': 33.0, '10GB': 40.0, '15GB': 58.0, '20GB': 75.0,
  '25GB': 92.0, '30GB': 108.0, '40GB': 140.0, '50GB': 175.0,
};

export const seedDatabase = async (): Promise<void> => {
  await Package.deleteMany({ network: { $nin: networks } });

  const networkImageMap: Record<string, string> = {
    MTN: '/images/mtn.jpg',
    Telecel: '/images/telecel.jpg',
    AirtelTigo: '/images/airteltigo.jpg',
  };

  const existingSettings = await Setting.findOne();
  if (existingSettings) {
    existingSettings.serviceImages = existingSettings.serviceImages
      .filter((img) => networks.includes(img.network as (typeof networks)[number]))
      .map((img) => ({
        ...img,
        imageUrl: networkImageMap[img.network] || img.imageUrl,
      }));
    existingSettings.markModified('complaintSettings.networkSettings');
    await existingSettings.save();
  }

  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(env.admin.password, 12);
    await User.create({
      fullName: env.admin.name,
      email: env.admin.email,
      phone: '0200000000',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    });
    console.log('Admin user seeded');
  }

  const dealerExists = await User.findOne({ role: 'dealer', email: env.demo.dealerEmail });
  if (!dealerExists) {
    await createDealerWithWallet({
      fullName: 'Demo Dealer',
      email: env.demo.dealerEmail,
      phone: '0240000001',
      password: env.demo.dealerPassword,
    });
    console.log(`Demo dealer seeded: ${env.demo.dealerEmail}`);
  }

  const resellerExists = await User.findOne({ role: 'reseller', email: env.demo.resellerEmail });
  if (!resellerExists) {
    await createResellerWithStore({
      fullName: 'Demo Reseller',
      email: env.demo.resellerEmail,
      phone: '0240000002',
      password: env.demo.resellerPassword,
      storeName: 'FastData GH',
      whatsapp: '0240000002',
      supportEmail: env.demo.resellerEmail,
      slug: 'fastdata-gh',
    });
    console.log(`Demo reseller seeded: ${env.demo.resellerEmail}`);
  }

  await ensureNetworkPackages();
  await reconcileLegacyPendingWithdrawals();

  const faqCount = await Faq.countDocuments();
  if (faqCount === 0) {
    await Faq.insertMany([
      { question: 'How long does delivery take?', answer: 'Most orders are delivered within 1-5 minutes. During peak hours, delivery may take up to 30 minutes.', sortOrder: 1 },
      { question: 'How do I fund my wallet?', answer: 'Dealers can fund their wallet via Paystack using Mobile Money or Bank Card from the dealer dashboard.', sortOrder: 2 },
      { question: 'How do I become a reseller?', answer: 'Click "Become A Reseller" on the homepage, complete registration, and set up your store profile.', sortOrder: 3 },
      { question: 'Can I buy in bulk?', answer: 'Yes! Dealers can use the bulk purchase feature to buy data for multiple numbers at once.', sortOrder: 4 },
    ]);
    console.log('FAQs seeded');
  }

  const settingsExist = await Setting.findOne();
  if (!settingsExist) {
    await Setting.create({
      serviceImages: [
        { network: 'MTN', imageUrl: '/images/mtn.jpg', isAvailable: true },
        { network: 'Telecel', imageUrl: '/images/telecel.jpg', isAvailable: true },
        { network: 'AirtelTigo', imageUrl: '/images/airteltigo.jpg', isAvailable: true },
      ],
    });
    console.log('Settings seeded');
  }
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const ensureNetworkPackages = async () => {
  const latest = await Package.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  let sortOrder = (latest?.sortOrder ?? -1) + 1;
  let created = 0;

  for (const network of networks) {
    for (const bundle of bundles) {
      const exists = await Package.findOne({ network, bundleSize: bundle });
      if (exists) continue;

      const base = bundlePrices[bundle];
      await Package.create({
        network,
        bundleSize: bundle,
        costPrice: base,
        dealerPrice: round(base * 1.05),
        resellerBasePrice: round(base * 1.1),
        maxSellingPrice: round(base * 1.22),
        isEnabled: true,
        sortOrder: sortOrder++,
      });
      created++;
    }
  }

  if (created > 0) console.log(`Packages seeded/updated: ${created} bundles for MTN, Telecel, AirtelTigo`);
};

export const createDealerWithWallet = async (data: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) => {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  const dealer = await User.create({
    ...data,
    password: hashedPassword,
    role: 'dealer',
    status: 'active',
    dealerApi: {
      apiKey: generateApiKey(),
      secretKey: generateSecretKey(),
      ipWhitelist: [],
      isActive: true,
    },
  });
  await Wallet.create({ userId: dealer._id });
  return dealer;
};

export const createResellerWithStore = async (data: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  storeName: string;
  whatsapp: string;
  supportEmail: string;
  slug: string;
}) => {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  const reseller = await User.create({
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    password: hashedPassword,
    role: 'reseller',
    status: 'active',
    resellerStore: {
      storeName: data.storeName,
      slug: data.slug,
      phone: data.phone,
      whatsapp: data.whatsapp,
      supportEmail: data.supportEmail,
      isActive: true,
      isVerified: true,
      referralCode: generateReferralCode(),
      customPrices: {},
    },
  });
  await Wallet.create({ userId: reseller._id });

  return reseller;
};
