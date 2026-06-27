import "dotenv/config";
import { PrismaClient, EarnType, CommissionType } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding PAN database from existing CSV data...");

  // --- Merchants (from PyanAnnNgwe Merchant Data.csv) ---
  await prisma.merchant.createMany({
    data: [
      {
        merchantURL: "BerryBooTest",
        merchantName: "BerryBooTest",
        outletName: "OutletTest1",
        merchantTelegramID: "1829791581",
        active: true,
        earnType: EarnType.PERCENTAGE,
        earnValue: 5,
        commissionType: CommissionType.PERCENTAGE,
        commissionValue: 1,
        rebateValidityDays: 14,
        firstReminderDays: 10,
        secondReminderDays: 13,
        firstRecallCampaignDays: 10,
        secondRecallCampaignDays: 12,
      },
      {
        merchantURL: "QQHotpotBBQ",
        merchantName: "QQ Hotpot BBQ",
        outletName: "South Okkalapa",
        merchantTelegramID: "8942997056",
        active: true,
        earnType: EarnType.PERCENTAGE,
        earnValue: 10,
        commissionType: CommissionType.PERCENTAGE,
        commissionValue: 0,
        rebateValidityDays: 14,
        firstReminderDays: 7,
        secondReminderDays: 10,
        firstRecallCampaignDays: 21,
        secondRecallCampaignDays: 30,
      },
      {
        merchantURL: "Test1",
        merchantName: "MerchantTest",
        outletName: "OutletTest1",
        merchantTelegramID: "1621662882",
        active: true,
        earnType: EarnType.PERCENTAGE,
        earnValue: 10,
        commissionType: CommissionType.PERCENTAGE,
        commissionValue: 1,
        rebateValidityDays: 14,
        firstReminderDays: 10,
        secondReminderDays: 12,
        firstRecallCampaignDays: 10,
      },
    ],
    skipDuplicates: true,
  });

  // --- Customers (from PyanAnnNgwe Customer Data.csv) ---
  await prisma.customer.createMany({
    data: [
      { customerTelegramID: "8517287235", firstName: "Simon", lastName: "Ong" },
      { customerTelegramID: "1621662882", username: "zilianprince", firstName: "Simon" },
      { customerTelegramID: "442228098", username: "vivienpan", firstName: "V" },
      { customerTelegramID: "5007786626", username: "Vish1511", firstName: "Vish" },
      { customerTelegramID: "8791498220", username: "Berryboo914", firstName: "Berryboo" },
      { customerTelegramID: "1829791581", username: "Berry91124", firstName: "berry" },
    ],
    skipDuplicates: true,
  });

  // --- Cashbacks (from PyanAnnNgwe Customer Cashback.csv) ---
  await prisma.cashback.createMany({
    data: [
      { merchantURL: "Test1", customerTelegramID: "8517287235", cashbackAmt: 5000, expiryDate: new Date("2026-06-07"), redeemed: true, redemptionDate: new Date("2026-05-25") },
      { merchantURL: "QQHotpotBBQ", customerTelegramID: "8517287235", cashbackAmt: 4750, expiryDate: new Date("2026-06-02"), redeemed: true, redemptionDate: new Date("2026-05-26") },
      { merchantURL: "Test1", customerTelegramID: "442228098", cashbackAmt: 5000, expiryDate: new Date("2026-06-07"), redeemed: true },
      { merchantURL: "Test1", customerTelegramID: "5007786626", cashbackAmt: 5000, expiryDate: new Date("2026-06-07"), redeemed: true },
      { merchantURL: "Test1", customerTelegramID: "8517287235", cashbackAmt: 49763, expiryDate: new Date("2026-06-07"), redeemed: true, redemptionDate: new Date("2026-05-25") },
      { merchantURL: "Test1", customerTelegramID: "8517287235", cashbackAmt: 2512, expiryDate: new Date("2026-06-07"), redeemed: true, redemptionDate: new Date("2026-05-25") },
      { merchantURL: "Test1", customerTelegramID: "8517287235", cashbackAmt: 2387, expiryDate: new Date("2026-06-07"), redeemed: true, redemptionDate: new Date("2026-05-25") },
      { merchantURL: "Test1", customerTelegramID: "8517287235", cashbackAmt: 47017, expiryDate: new Date("2026-06-08"), redeemed: false },
      { merchantURL: "QQHotpotBBQ", customerTelegramID: "8517287235", cashbackAmt: 9763, expiryDate: new Date("2026-06-24"), redeemed: true, redemptionDate: new Date("2026-05-26") },
      { merchantURL: "QQHotpotBBQ", customerTelegramID: "8517287235", cashbackAmt: 4512, expiryDate: new Date("2026-06-25"), redeemed: false },
      { merchantURL: "BerryBooTest", customerTelegramID: "8791498220", cashbackAmt: 25000, expiryDate: new Date("2026-06-11"), redeemed: false },
    ],
    skipDuplicates: false,
  });

  // --- Message Templates (from PyanAnnNgwe Merchant Custom Reply.csv) ---
  const triggerMap: Record<string, string> = {
    "To: Customer - Cashback Information and PIN": "CASHBACK_ISSUED",
    "To: Customer - Redemption Failure": "REDEMPTION_FAILURE",
    "To: Customer - New Rebate with redemption": "CASHBACK_ISSUED_WITH_REDEMPTION",
    "To: Customer - Custom Message - Cashback Expiry First Reminder": "EXPIRY_FIRST_REMINDER",
    "To: Customer - Custom Message - Cashback Expiry Second Reminder": "EXPIRY_SECOND_REMINDER",
    "To: Customer - Custom Message - First Recall Campaign": "FIRST_RECALL_CAMPAIGN",
    "To: Customer - Custom Message - Second Recall Campaign": "SECOND_RECALL_CAMPAIGN",
  };

  const templateData = [
    { merchantURL: "Test1", trigger: "CASHBACK_ISSUED", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/ChatGPT-Image-May-24-2026-06_24_04-PM-2.png" },
    { merchantURL: "Test1", trigger: "REDEMPTION_FAILURE", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/ChatGPT-Image-May-24-2026-06_47_58-PM.png" },
    { merchantURL: "Test1", trigger: "CASHBACK_ISSUED_WITH_REDEMPTION", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/Copilot_20260524_193015.png" },
    { merchantURL: "Test1", trigger: "EXPIRY_FIRST_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/Copilot_20260525_152811.png" },
    { merchantURL: "Test1", trigger: "EXPIRY_SECOND_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/Copilot_20260525_153020.png" },
    { merchantURL: "QQHotpotBBQ", trigger: "CASHBACK_ISSUED", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQCustom1.png" },
    { merchantURL: "QQHotpotBBQ", trigger: "REDEMPTION_FAILURE", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-2.png" },
    { merchantURL: "QQHotpotBBQ", trigger: "CASHBACK_ISSUED_WITH_REDEMPTION", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-3.png" },
    { merchantURL: "QQHotpotBBQ", trigger: "EXPIRY_FIRST_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-4.png" },
    { merchantURL: "QQHotpotBBQ", trigger: "EXPIRY_SECOND_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-4.png" },
    { merchantURL: "BerryBooTest", trigger: "CASHBACK_ISSUED", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQCustom1.png" },
    { merchantURL: "BerryBooTest", trigger: "REDEMPTION_FAILURE", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-2.png" },
    { merchantURL: "BerryBooTest", trigger: "CASHBACK_ISSUED_WITH_REDEMPTION", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-3.png" },
    { merchantURL: "BerryBooTest", trigger: "EXPIRY_FIRST_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-4.png" },
    { merchantURL: "BerryBooTest", trigger: "EXPIRY_SECOND_REMINDER", imageURL: "http://qqhotpotbbq.com/wp-content/uploads/2026/05/QQ-Custom-4.png" },
  ];

  for (const t of templateData) {
    await prisma.messageTemplate.upsert({
      where: {
        merchantURL_platform_trigger: {
          merchantURL: t.merchantURL,
          platform: "TELEGRAM",
          trigger: t.trigger as never,
        },
      },
      create: {
        merchantURL: t.merchantURL,
        platform: "TELEGRAM",
        trigger: t.trigger as never,
        imageURL: t.imageURL,
      },
      update: { imageURL: t.imageURL },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
