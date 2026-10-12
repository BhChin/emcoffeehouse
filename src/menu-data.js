/**
 * The full menu.
 *
 * Descriptions are VERBATIM from the shop's list. Several items deliberately
 * have none — an absent `note` means the real menu carries no description for
 * that item, not that one is pending. Do not fill them in.
 *
 * `img` is optional. Where it is missing the page renders a designed
 * placeholder built from the category tint (see DrinkImage in menu-page.js),
 * never a grey box. Paths point at /assets/menu/<slug>.png by convention; the
 * four wired below reuse the existing carousel photos so the page ships with a
 * genuine mix of real and placeholder and proves that state reads correctly.
 *
 * Prices are intentionally absent — every card shows a muted "$—" slot.
 * TODO: add `price` per item once the real numbers are confirmed.
 */
export const MENU_CATEGORIES = [
  {
    id: 'signature',
    name: 'Em Signature Cream Coffee',
    tint: '#B4783A',
    items: [
      { name: 'Banana Toffee Latte', note: 'Viet phin coffee latte with banana cream & toffee bits' },
      { name: 'Egg Brulee Cream Coffee', note: 'Viet phin coffee with egg cream brulee top', img: '/drink-egg.png' },
      { name: 'Pandan Coconut Latte', note: 'Viet phin coffee latte with coconut pandan cream top & coconut flakes' },
      { name: 'Coco Ube Cream Coffee', note: 'Viet phin coffee with ube cream & coconut flakes' },
      { name: 'White Truffle Tiramisu Cream Coffee', note: 'Viet phin coffee with sweet white truffle mascarpone cream, tiramisu style' },
      { name: 'Matcha Cream Coffee', note: 'Viet phin milk coffee with ceremonial matcha cream top' },
    ],
  },
  {
    id: 'ceremonial-matcha',
    name: 'Ceremonial Matcha',
    tint: '#7A9B57',
    items: [
      { name: 'Matcha Einspanner', note: 'Ceremonial matcha latte with house salted vanilla cream' },
      { name: 'Ube Matcha', note: 'Ceremonial matcha latte with ube cream' },
      { name: 'Matcha Coconut Blast', note: 'Coconut milk slush & matcha ice cream with ceremonial matcha, topped with whipped cream & coconut flakes', img: '/drink-matcha.png' },
      { name: 'Brown Sugar Matcha', note: 'Ceremonial matcha latte with brown sugar, topped with vanilla salted cream & brown sugar brulee' },
      { name: 'Tiramisu Matcha', note: 'Ceremonial matcha latte with tiramisu flavor, topped with vanilla salted cream, cacao & white chocolate' },
      { name: 'Double Matcha Float', note: 'Ceremonial matcha latte with matcha ice cream' },
      { name: 'Banana Matcha', note: 'Ceremonial matcha latte with banana cream & banana chips' },
      { name: 'Pandan Coconut Matcha', note: 'Ceremonial matcha latte with pandan cream & toasted coconut flakes' },
      { name: 'Strawberry Matcha', note: 'Ceremonial matcha latte with strawberry puree' },
    ],
  },
  {
    id: 'matcha-latte',
    name: 'Matcha Latte',
    tint: '#7A9B57',
    items: [
      { name: 'Double Matcha Cream', note: 'Matcha latte with matcha cream top' },
      { name: 'London Fog Salted Matcha', note: 'Earl grey matcha with salted vanilla cream' },
    ],
  },
  {
    id: 'viet-phin',
    name: 'Viet Phin Drip Coffee',
    tint: '#7A4E2D',
    items: [
      { name: 'Super Coconut Coffee Blast', note: 'Ice-blended coconut coffee, coconut ice cream, whipped cream & coconut flakes' },
      { name: 'Em Coffee — Cà Phê Sữa Đá', note: 'Signature blend phin drip milk coffee', img: '/drink-suada.png', badge: 'Best seller' },
      { name: 'Marble Latte Bạc Xỉu', note: 'Signature blend phin drip milk coffee & milk', img: '/drink.png' },
      { name: 'Em Black Phin Coffee', note: 'Signature blend phin drip black coffee' },
    ],
  },
  {
    id: 'espresso',
    name: 'Espresso',
    tint: '#5C3A21',
    items: [
      { name: 'Spanish Latte', note: 'Condensed milk, milk & espresso' },
      { name: 'Vanilla Latte' },
      { name: 'Hazelnut Latte' },
      { name: 'Latte', note: 'Espresso & milk' },
      { name: 'Americano' },
      { name: 'Brown Sugar Latte', note: 'Espresso latte with brown sugar syrup' },
      { name: 'Caramel Macchiato', note: 'Vanilla & caramel sauce with milk & espresso' },
    ],
  },
  {
    id: 'seasonal',
    name: 'Seasonal Series',
    aside: 'for a limited time',
    tint: '#8B6FA8',
    items: [
      { name: 'Ube Milk Coffee Latte', note: 'Ube milk with Viet milk coffee latte' },
      { name: 'Matcha Cream Ube Milk', note: 'Ube milk with silky matcha cream top' },
      { name: 'Ube Milk Matcha', note: 'Ube milk with ceremonial matcha' },
      { name: 'Ube Milk Latte (Decaf)' },
    ],
  },
  {
    id: 'tea',
    name: 'Tea Refreshers',
    tint: '#D4537E',
    items: [
      { name: 'Royal Pink Lychee Tea', note: 'Green & hibiscus tea with fresh lychee' },
      { name: 'Sky Peach Tea', note: 'Green & butterfly pea tea with fresh peach' },
      { name: 'Strawberry Refresher', note: 'Green tea with strawberry puree' },
      { name: 'Citrus Lemongrass Refresher', note: 'Orange juice & peach tea with lemongrass extract' },
    ],
  },
  {
    id: 'pastry',
    name: 'Pastry & Bites',
    tint: '#C1862B',
    items: [
      { name: 'Chocolate Croissant' },
      { name: 'Ham & Cheese Croissant', badge: 'Best seller' },
      { name: 'Banana Nut Bread Slice', soldOut: true },
      { name: 'Bacon Breakfast Sandwich', note: 'Egg, bacon & cheese on a toasted biscuit bun' },
      { name: 'Croissant' },
      { name: 'Apple Danish' },
      { name: 'Cheese Danish' },
      { name: 'Raspberry Danish' },
    ],
  },
];
