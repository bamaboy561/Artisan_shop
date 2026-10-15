// «3 100 сом»: так пишут цены покупатели и мы во всех текстах сайта.
const priceNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export function formatPrice(value: number) {
  return `${priceNumber.format(value)} сом`;
}
