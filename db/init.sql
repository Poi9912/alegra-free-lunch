INSERT INTO ingredients (name) VALUES ('tomato');
INSERT INTO ingredients (name) VALUES ('lemon');
INSERT INTO ingredients (name) VALUES ('potato');
INSERT INTO ingredients (name) VALUES ('rice');
INSERT INTO ingredients (name) VALUES ('ketchup');
INSERT INTO ingredients (name) VALUES ('lettuce');
INSERT INTO ingredients (name) VALUES ('onion');
INSERT INTO ingredients (name) VALUES ('cheese');
INSERT INTO ingredients (name) VALUES ('meat');
INSERT INTO ingredients (name) VALUES ('chicken');

INSERT INTO ingredients_inventory (ingredient_id,quantity)
SELECT id, 5 FROM ingredients;

INSERT INTO recipes (product) VALUES ('Arroz con pollo');
INSERT INTO recipes (product) VALUES ('Bandeja con carne asada');
INSERT INTO recipes (product) VALUES ('Carne gulash');
INSERT INTO recipes (product) VALUES ('Bandeja con pechuga gratinada');
INSERT INTO recipes (product) VALUES ('Sudado Mixto');
INSERT INTO recipes (product) VALUES ('Crema de tomate');

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='rice'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='chicken'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='lemon'),
  2
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='lettuce'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Arroz con pollo'),
  (SELECT id FROM ingredients WHERE name='ketchup'),
  1
);

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='meat'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='lemon'),
  2
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con carne asada'),
  (SELECT id FROM ingredients WHERE name='lettuce'),
  1
);

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='lemon'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='meat'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Carne gulash'),
  (SELECT id FROM ingredients WHERE name='rice'),
  1
);

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='cheese'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='chicken'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='lettuce'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Bandeja con pechuga gratinada'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='rice'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='meat'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='chicken'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='lemon'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Sudado Mixto'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  1
);

INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='tomato'),
  2
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='onion'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='potato'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='cheese'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='meat'),
  1
);
INSERT INTO recipe_ingredients (recipe_id,ingredient_id,quantity) VALUES (
  (SELECT id FROM recipes WHERE product='Crema de tomate'),
  (SELECT id FROM ingredients WHERE name='lemon'),
  1
);

INSERT INTO "users" ("username", "password_hash", "role") 
VALUES ('manager', '$2b$10$nBEXgYHaoNzBz4Ma9pZyd.A3Rumud.TuuMqtMotOSuNu1mm2et.nm', 'manager')
ON CONFLICT (username) DO NOTHING;

INSERT INTO "users" ("username", "password_hash", "role") 
VALUES ('operation', '$2b$10$IbA0CKKHjf1BvBEv1acG2ewQlHRnDq5rput0YlYREHBO2.mEJdm9i', 'operation')
ON CONFLICT (username) DO NOTHING;