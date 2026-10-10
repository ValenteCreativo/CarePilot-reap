import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  phoneNumber: text("phone_number").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
