/**
 * seed-productos.ts
 * Productos precargados para kioscos argentinos.
 * Marcas: Coca-Cola Company, PepsiCo, Arcor, Terrabusi, Yerbas.
 */

export interface SeedProducto {
  nombre: string;
  categoria: string;
  precio_venta: number;
  codigo_barras?: string;
  unidad_medida?: string;
  marca?: string;
}

// ─────────────────────────────────────────────────────────
// COCA-COLA COMPANY
// ─────────────────────────────────────────────────────────
const cocaCola: SeedProducto[] = [
  // Coca-Cola
  { nombre: 'Coca-Cola 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 600ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 1L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 1.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 2L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola 3L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Coca-Cola Zero
  { nombre: 'Coca-Cola Zero 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola Zero 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola Zero 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola Zero 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Coca-Cola Light
  { nombre: 'Coca-Cola Light 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Coca-Cola Light 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Sprite
  { nombre: 'Sprite 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Sprite 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Sprite 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Sprite 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Sprite 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Fanta
  { nombre: 'Fanta Naranja 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Naranja 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Naranja 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Naranja 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Naranja 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Limón 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Limón 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Fanta Uva 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Schweppes
  { nombre: 'Schweppes Tónica 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Tónica 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Tónica 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Pomelo 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Pomelo 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Limón 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Schweppes Limón 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Powerade
  { nombre: 'Powerade Mountain Blast 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Powerade Frutas del Bosque 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Powerade Naranja 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Powerade Limón 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Aquarius
  { nombre: 'Aquarius Naranja 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Aquarius Manzana 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Aquarius Limón 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Cepita
  { nombre: 'Cepita Naranja 200ml', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Naranja 1L', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Durazno 200ml', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Durazno 1L', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Manzana 200ml', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Manzana 1L', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Cepita Multifrutas 1L', categoria: 'Jugos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Dasani
  { nombre: 'Dasani Agua 500ml', categoria: 'Aguas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  { nombre: 'Dasani Agua 1.5L', categoria: 'Aguas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Burn
  { nombre: 'Burn Energy 473ml Lata', categoria: 'Energizantes', precio_venta: 0, unidad_medida: 'unidad', marca: 'Coca-Cola Company' },
  // Monster (distribuido por Coca-Cola)
  { nombre: 'Monster Energy 473ml Lata', categoria: 'Energizantes', precio_venta: 0, unidad_medida: 'unidad', marca: 'Monster Beverage' },
  { nombre: 'Monster Energy Ultra 473ml Lata', categoria: 'Energizantes', precio_venta: 0, unidad_medida: 'unidad', marca: 'Monster Beverage' },
  { nombre: 'Monster Pipeline Punch 473ml Lata', categoria: 'Energizantes', precio_venta: 0, unidad_medida: 'unidad', marca: 'Monster Beverage' },
  { nombre: 'Monster Mango Loco 473ml Lata', categoria: 'Energizantes', precio_venta: 0, unidad_medida: 'unidad', marca: 'Monster Beverage' },
];

// ─────────────────────────────────────────────────────────
// PEPSICO
// ─────────────────────────────────────────────────────────
const pepsico: SeedProducto[] = [
  // Pepsi
  { nombre: 'Pepsi 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi 3L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Pepsi Black
  { nombre: 'Pepsi Black 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi Black 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi Black 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Pepsi Black 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // 7Up
  { nombre: '7Up 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: '7Up 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: '7Up 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: '7Up 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: '7Up 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: '7Up Free 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Mirinda
  { nombre: 'Mirinda Naranja 237ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Naranja 354ml Lata', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Naranja 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Naranja 1.5L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Naranja 2.25L', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Limón 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Mirinda Uva 500ml', categoria: 'Gaseosas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // H2Oh!
  { nombre: 'H2Oh! Limón 500ml', categoria: 'Aguas Saborizadas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'H2Oh! Manzana 500ml', categoria: 'Aguas Saborizadas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'H2Oh! Naranja 500ml', categoria: 'Aguas Saborizadas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'H2Oh! Pomelo 500ml', categoria: 'Aguas Saborizadas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Gatorade
  { nombre: 'Gatorade Naranja 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Limón 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Manzana 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Uva 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Frutas Tropicales 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Sandía 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Gatorade Mandarina 500ml', categoria: 'Isotónicas', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Lipton
  { nombre: 'Lipton Té Limón 500ml', categoria: 'Tés', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Lipton Té Durazno 500ml', categoria: 'Tés', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Lipton Té Verde 500ml', categoria: 'Tés', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Lay's / Doritos / Cheetos (snacks PepsiCo)
  { nombre: "Lay's Clásicas 55g", categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: "Lay's Clásicas 135g", categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: "Lay's Clásicas 190g", categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: "Lay's Sal y Vinagre 55g", categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: "Lay's Cheddar 55g", categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Doritos Nacho 145g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Doritos Nacho 90g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Doritos Nacho 40g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Doritos Queso 145g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Doritos Cool Ranch 145g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Cheetos Clásicos 55g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Cheetos Clásicos 100g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Cheetos Flamin Hot 55g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Ruffles Clásicas 55g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Ruffles Cheddar 55g', categoria: 'Snacks', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  // Quaker
  { nombre: 'Quaker Avena Tradicional 500g', categoria: 'Cereales', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
  { nombre: 'Quaker Granola Frutas 400g', categoria: 'Cereales', precio_venta: 0, unidad_medida: 'unidad', marca: 'PepsiCo' },
];

// ─────────────────────────────────────────────────────────
// ARCOR
// ─────────────────────────────────────────────────────────
const arcor: SeedProducto[] = [
  // Chocolates
  { nombre: 'Bon o Bon Blanco 16g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Bon o Bon Leche 16g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Bon o Bon Caja 12u', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cofler Leche 55g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cofler Aireado 55g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cofler Blanco 55g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cofler Negro 55g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cofler Naranja 55g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Fulbito Caramelos Fútbol 18g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Rocklets Leche 40g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Rocklets Blanco 40g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Golosinas / Caramelos
  { nombre: 'Mentitas Menta 28g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Palitos de la Selva 100g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cabsha 12.5g', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Cabsha Caja 18u', categoria: 'Chocolates', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Butter Toffees Manteca 100g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Butter Toffees Vainilla 100g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Butter Toffees Chocolate 100g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Butter Toffees Frutilla 100g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Pop Rocks Frutilla 7g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Pop Rocks Sandía 7g', categoria: 'Caramelos', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Chicles
  { nombre: 'Topline Menta 10u', categoria: 'Chicles', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Topline Spearmint 10u', categoria: 'Chicles', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Obleas / Galletitas
  { nombre: 'Oblea Ópera Vainilla 28g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Oblea Ópera Chocolate 28g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Oblea Ópera Frutilla 28g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Conservas / Mermeladas Arcor
  { nombre: 'Mermelada Arcor Durazno 390g', categoria: 'Mermeladas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Mermelada Arcor Frutilla 390g', categoria: 'Mermeladas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Mermelada Arcor Ciruela 390g', categoria: 'Mermeladas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Mermelada Arcor Naranja 390g', categoria: 'Mermeladas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Jugos Arcor
  { nombre: 'Arcor Vital Naranja 12 sobres', categoria: 'Jugos en Polvo', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Arcor Vital Limón 12 sobres', categoria: 'Jugos en Polvo', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Arcor Vital Frutilla 12 sobres', categoria: 'Jugos en Polvo', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Arcor Vital Manzana 12 sobres', categoria: 'Jugos en Polvo', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Arcor Vital Ananá 12 sobres', categoria: 'Jugos en Polvo', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Aceites / Tomates (Arcor tiene la línea Tomate Don Pepino)
  { nombre: 'Tomate Triturado Arcor 520g', categoria: 'Conservas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Puré de Tomate Arcor 520g', categoria: 'Conservas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  // Helados (Arcor / Frigor)
  { nombre: 'Palito Helado Arcor Chocolate', categoria: 'Helados', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Palito Helado Arcor Vainilla', categoria: 'Helados', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
  { nombre: 'Palito Helado Arcor Frutilla', categoria: 'Helados', precio_venta: 0, unidad_medida: 'unidad', marca: 'Arcor' },
];

// ─────────────────────────────────────────────────────────
// TERRABUSI
// ─────────────────────────────────────────────────────────
const terrabusi: SeedProducto[] = [
  // Galletitas dulces
  { nombre: 'Terrabusi Naranja 120g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Naranja 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Limón 120g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Limón 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Vainilla 120g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Vainilla 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Chocolate 120g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Terrabusi Chocolate 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Oreo
  { nombre: 'Oreo Original 25.6g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Original 117g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Original 231g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Original 378g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Doble Relleno 117g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Doble Relleno 231g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Choco 117g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Frutilla 117g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Oreo Golden 117g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Express / Melba
  { nombre: 'Express Membrillo 140g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Express Dulce de Leche 140g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Melba Pan Tostado 200g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Crackers
  { nombre: 'Crackers Terrabusi Clásicas 164g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Crackers Terrabusi Integrales 164g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Sonrisas
  { nombre: 'Sonrisas 230g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Tentación
  { nombre: 'Tentación Chocolate 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Opera
  { nombre: 'Opera Vainilla 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Opera Chocolate 300g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  // Variedad
  { nombre: 'Factor G Manteca 120g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Traviata Queso 150g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
  { nombre: 'Traviata Cebolla 150g', categoria: 'Galletitas', precio_venta: 0, unidad_medida: 'unidad', marca: 'Terrabusi' },
];

// ─────────────────────────────────────────────────────────
// YERBA MATE (marcas argentinas y uruguayas con fuerte
// presencia en Argentina)
// ─────────────────────────────────────────────────────────
const yerbas: SeedProducto[] = [
  // Rosamonte
  { nombre: 'Rosamonte Elaborada 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Elaborada 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Elaborada 2kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Especial 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Especial 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  { nombre: 'Rosamonte Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Rosamonte' },
  // Taragüí
  { nombre: 'Taragüí Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Taragüí Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Taragüí Con Palo 2kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Taragüí Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Taragüí En Saquitos x25', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Taragüí Naranja 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  // Amanda
  { nombre: 'Amanda Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Amanda' },
  { nombre: 'Amanda Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Amanda' },
  { nombre: 'Amanda Con Palo 2kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Amanda' },
  { nombre: 'Amanda Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Amanda' },
  { nombre: 'Amanda Despalada 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Amanda' },
  // Cruz de Malta
  { nombre: 'Cruz de Malta Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Cruz de Malta' },
  { nombre: 'Cruz de Malta Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Cruz de Malta' },
  { nombre: 'Cruz de Malta Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Cruz de Malta' },
  { nombre: 'Cruz de Malta Con Palo 2kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Cruz de Malta' },
  // La Merced
  { nombre: 'La Merced Clásica 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'La Merced' },
  { nombre: 'La Merced Clásica 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'La Merced' },
  { nombre: 'La Merced Selección Especial 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'La Merced' },
  { nombre: 'La Merced Liviana 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'La Merced' },
  // Playadito
  { nombre: 'Playadito Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Playadito' },
  { nombre: 'Playadito Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Playadito' },
  { nombre: 'Playadito Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Playadito' },
  { nombre: 'Playadito Con Palo 2kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Playadito' },
  // Nobleza Gaucha
  { nombre: 'Nobleza Gaucha Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Nobleza Gaucha' },
  { nombre: 'Nobleza Gaucha Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Nobleza Gaucha' },
  { nombre: 'Nobleza Gaucha Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Nobleza Gaucha' },
  // Mañanita
  { nombre: 'Mañanita Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Mañanita' },
  { nombre: 'Mañanita Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Mañanita' },
  // Aguantadora
  { nombre: 'Aguantadora Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Aguantadora' },
  // Canarias
  { nombre: 'Canarias Con Palo 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Canarias' },
  { nombre: 'Canarias Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Canarias' },
  // CBSe (compuesta con hierbas)
  { nombre: 'CBSe Clásica 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'CBSe' },
  { nombre: 'CBSe Energizante 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'CBSe' },
  { nombre: 'CBSe Naranja y Menta 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'CBSe' },
  { nombre: 'CBSe Limón 500g', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'CBSe' },
  // Pipore
  { nombre: 'Pipore Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Pipore' },
  { nombre: 'Pipore Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Pipore' },
  // Liebig / Union
  { nombre: 'Unión Con Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Unión' },
  { nombre: 'Unión Sin Palo 1kg', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Unión' },
  // Mate Cocido
  { nombre: 'Taragüí Mate Cocido x25 saquitos', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Taragüí' },
  { nombre: 'Nobleza Gaucha Mate Cocido x25', categoria: 'Yerba Mate', precio_venta: 0, unidad_medida: 'unidad', marca: 'Nobleza Gaucha' },
];

export const seedProductos: SeedProducto[] = [
  ...cocaCola,
  ...pepsico,
  ...arcor,
  ...terrabusi,
  ...yerbas,
];
