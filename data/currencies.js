// List of supported currencies with their symbols and codes
var SUPPORTED_CURRENCIES = [
  {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    country: "United States of America"
  },
  {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    country: "Multiple European countries"
  },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    country: "United Kingdom"
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    country: "Australia"
  },
  {
    code: "BRL",
    symbol: "R$",
    name: "Brazilian Real",
    country: "Brazil"
  },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    country: "Canada"
  },
  {
    code: "CLP",
    symbol: "CLP$",
    name: "Chilean Peso",
    country: "Chile"
  },
  {
    code: "COP",
    symbol: "COP$",
    name: "Colombian Peso",
    country: "Colombia"
  },
  {
    code: "CRC",
    symbol: "₡",
    name: "Costa Rican Colón",
    country: "Costa Rica"
  },
  {
    code: "DOP",
    symbol: "RD$",
    name: "Dominican Peso",
    country: "Dominican Republic"
  },
  {
    code: "GHS",
    symbol: "GH₵",
    name: "Ghanaian Cedi",
    country: "Ghana"
  },
  {
    code: "GTQ",
    symbol: "Q",
    name: "Guatemalan Quetzal",
    country: "Guatemala"
  },
  {
    code: "HNL",
    symbol: "L",
    name: "Honduran Lempira",
    country: "Honduras"
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    country: "India"
  },
  {
    code: "KZT",
    symbol: "₸",
    name: "Kazakhstani Tenge",
    country: "Kazakhstan"
  },
  {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling",
    country: "Kenya"
  },
  {
    code: "MXN",
    symbol: "Mex$",
    name: "Mexican Peso",
    country: "Mexico"
  },
  {
    code: "MNT",
    symbol: "₮",
    name: "Mongolian Tugrik",
    country: "Mongolia"
  },
  {
    code: "NAD",
    symbol: "N$",
    name: "Namibian Dollar",
    country: "Namibia"
  },
  {
    code: "NZD",
    symbol: "NZ$",
    name: "New Zealand Dollar",
    country: "New Zealand"
  },
  {
    code: "NIO",
    symbol: "C$",
    name: "Nicaraguan Córdoba",
    country: "Nicaragua"
  },
  {
    code: "PAB",
    symbol: "B/.",
    name: "Panamanian Balboa",
    country: "Panama"
  },
  {
    code: "PYG",
    symbol: "₲",
    name: "Paraguayan Guarani",
    country: "Paraguay"
  },
  {
    code: "PEN",
    symbol: "S/.",
    name: "Peruvian Sol",
    country: "Peru"
  },
  {
    code: "PHP",
    symbol: "₱",
    name: "Philippine Peso",
    country: "Philippines"
  },
  {
    code: "RSD",
    symbol: "din.",
    name: "Serbian Dinar",
    country: "Serbia"
  },
  {
    code: "SCR",
    symbol: "SR",
    name: "Seychellois Rupee",
    country: "Seychelles"
  },
  {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    country: "South Africa"
  },
  {
    code: "TWD",
    symbol: "NT$",
    name: "New Taiwan Dollar",
    country: "Taiwan"
  },
  {
    code: "UGX",
    symbol: "USh",
    name: "Ugandan Shilling",
    country: "Uganda"
  },
  {
    code: "AED",
    symbol: "د.إ",
    name: "United Arab Emirates Dirham",
    country: "United Arab Emirates"
  },
  {
    code: "UYU",
    symbol: "$U",
    name: "Uruguayan Peso",
    country: "Uruguay"
  },
  {
    code: "VND",
    symbol: "₫",
    name: "Vietnamese Dong",
    country: "Vietnam"
  },
  {
    code: "XOF",
    symbol: "CFA",
    name: "West African CFA Franc",
    country: "Côte D'Ivoire (Ivory Coast), Benin, Gabon"
  },
  {
    code: "AZN",
    symbol: "₼",
    name: "Azerbaijani Manat",
    country: "Azerbaijan"
  },
  {
    code: "BHD",
    symbol: ".د.ب",
    name: "Bahraini Dinar",
    country: "Bahrain"
  },
  {
    code: "BBD",
    symbol: "Bds$",
    name: "Barbadian Dollar",
    country: "Barbados, Antigua and Barbuda"
  },
  {
    code: "GEL",
    symbol: "₾",
    name: "Georgian Lari",
    country: "Georgia"
  },
  {
    code: "GNF",
    symbol: "FG",
    name: "Guinean Franc",
    country: "Guinea"
  },
  {
    code: "LAK",
    symbol: "₭",
    name: "Lao Kip",
    country: "Laos"
  },
  {
    code: "MZN",
    symbol: "MT",
    name: "Mozambican Metical",
    country: "Mozambique"
  },
  {
    code: "MNE",
    symbol: "€",
    name: "Euro (Montenegro)",
    country: "Montenegro"
  }
];

// We're using this as a global variable, so no export is needed