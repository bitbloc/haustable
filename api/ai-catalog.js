const AI_CATALOG_DATA = {
  "specVersion": "1.0",
  "host": {
    "displayName": "IN THE HAUS | ร้านในบ้าน นครพนม",
    "identifier": "https://haustable.vercel.app",
    "documentationUrl": "https://haustable.vercel.app/qa",
    "logoUrl": "https://haustable.vercel.app/logo.png"
  },
  "entries": [
    {
      "identifier": "urn:air:haustable:restaurant:menu",
      "displayName": "In the haus Menu & Signature Dishes",
      "type": "application/agent-card+json",
      "url": "https://haustable.vercel.app/link",
      "description": "Catalog of authentic Southern Thai cuisine, drinks, coffee, and signature dishes at IN THE HAUS Nakhon Phanom.",
      "representativeQueries": [
        "เมนูร้านในบ้าน นครพนม",
        "ร้านอาหารริมโขง นครพนม เมนู",
        "อาหารใต้รสจัด นครพนม",
        "in the haus nakhon phanom menu"
      ]
    },
    {
      "identifier": "urn:air:haustable:restaurant:table-booking",
      "displayName": "Table Reservation Service",
      "type": "application/agent-card+json",
      "url": "https://haustable.vercel.app/booking",
      "description": "Online real-time table reservation and seating booking system for IN THE HAUS.",
      "representativeQueries": [
        "จองโต๊ะร้านในบ้าน",
        "จองโต๊ะร้านอาหารริมโขง นครพนม",
        "book table at in the haus nakhon phanom"
      ]
    },
    {
      "identifier": "urn:air:haustable:restaurant:online-pickup",
      "displayName": "Online Pickup Order Service",
      "type": "application/agent-card+json",
      "url": "https://haustable.vercel.app/pickup",
      "description": "Storefront takeout and online food ordering system for pickup at IN THE HAUS.",
      "representativeQueries": [
        "สั่งอาหารรับหน้าร้าน ในบ้าน",
        "สั่งอาหารล่วงหน้า นครพนม",
        "online pickup order in the haus"
      ]
    },
    {
      "identifier": "urn:air:haustable:restaurant:restaurant-qa",
      "displayName": "Restaurant Information, Location & FAQ",
      "type": "application/agent-card+json",
      "url": "https://haustable.vercel.app/qa",
      "description": "Frequently asked questions, location directions along Mekong river, parking details, and opening hours for IN THE HAUS.",
      "representativeQueries": [
        "ร้านในบ้านเปิดกี่โมง",
        "ที่จอดรถร้านในบ้าน นครพนม",
        "in the haus nakhon phanom directions"
      ]
    }
  ]
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
  return res.status(200).json(AI_CATALOG_DATA)
}
