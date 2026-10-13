CREATE TYPE "order_status" AS ENUM (
  'created',
  'confirmed',
  'cooking',
  'ready',
  'delivered'
);

CREATE TABLE "ingredients" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar(255) UNIQUE NOT NULL
);

CREATE TABLE "ingredients_inventory" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ingredient_id" integer,
  "quantity" integer DEFAULT 0
);

CREATE TABLE "recipes" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "product" varchar(255) UNIQUE NOT NULL
);

CREATE TABLE "recipe_ingredients" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "recipe_id" integer,
  "ingredient_id" integer,
  "quantity" integer NOT NULL DEFAULT 1
);

CREATE TABLE "orders" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "order_number" varchar(255) UNIQUE NOT NULL,
  "recipe_id" integer NOT NULL,
  "status" order_status NOT NULL DEFAULT 'created',
  "created_at" timestamp DEFAULT (CURRENT_TIMESTAMP),
  "updated_at" timestamp DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE "inventory_purchase_history" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ingredient_id" integer,
  "quantity" integer NOT NULL DEFAULT 1,
  "purchased_at" timestamp DEFAULT (CURRENT_TIMESTAMP)
);

ALTER TABLE "ingredients_inventory" ADD FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id");

ALTER TABLE "recipe_ingredients" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id");

ALTER TABLE "recipe_ingredients" ADD FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id");

ALTER TABLE "orders" ADD FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id");

ALTER TABLE "inventory_purchase_history" ADD FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id");

CREATE INDEX "idx_orders_status" ON "orders" ("status");

CREATE INDEX "idx_orders_status_created" ON "orders" ("status", "created_at");
