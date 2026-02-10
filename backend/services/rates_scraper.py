import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime, timezone
import os
from database import DATA_DIR

def update_square_data():
    """Fetch currency rates from devisesquare.com and save to /data folder."""
    
    url = "https://devisesquare.com/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.content, 'html.parser')

        # Dictionary to store results
        data = {}

        # Currency mapping
        currency_map = {
            "EURO": "EUR",
            "US DOLLAR": "USD"
        }
        
        # Initialize with DZD as base and PLN placeholder
        data = {
            "DZD": {"buy": "1", "sell": "1"},
            "PLN": {"buy": "0", "sell": "0"} 
        }

        # Parse articles for currency rates
        articles = soup.find_all('article')
        
        for article in articles:
            header = article.find('h1')
            if not header:
                continue
                
            header_text = header.get_text(strip=True).upper()
            
            found_key = None
            for name, code in currency_map.items():
                if name in header_text:
                    found_key = code
                    break
            
            if found_key:
                buy_div = article.find(class_="buy")
                sell_div = article.find(class_="sell")
                
                buy_rate = "0"
                sell_rate = "0"
                
                if buy_div:
                    buy_h1 = buy_div.find('h1')
                    if buy_h1:
                        buy_rate = buy_h1.get_text(strip=True)
                
                if sell_div:
                    sell_h1 = sell_div.find('h1')
                    if sell_h1:
                        sell_rate = sell_h1.get_text(strip=True)
                        
                data[found_key] = {"buy": buy_rate, "sell": sell_rate}

        # --- Fetch PLN Rate (via public API) ---
        try:
            pln_response = requests.get("https://open.er-api.com/v6/latest/EUR", timeout=5)
            pln_data = pln_response.json()
            eur_to_pln = pln_data["rates"]["PLN"]
            
            if "EUR" in data and float(data["EUR"]["buy"]) > 0:
                eur_buy_dzd = float(data["EUR"]["buy"])
                eur_sell_dzd = float(data["EUR"]["sell"])
                
                pln_buy_dzd = round(eur_buy_dzd / eur_to_pln, 2)
                pln_sell_dzd = round(eur_sell_dzd / eur_to_pln, 2)
                
                data["PLN"] = {
                    "buy": str(pln_buy_dzd),
                    "sell": str(pln_sell_dzd),
                    "rate_eur_pln": str(eur_to_pln)
                }
        except Exception as e:
            print(f"⚠️ Could not fetch PLN rates: {e}")

        # Add timestamp
        data["last_update"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        # --- Save rates.json ---
        rates_path = os.path.join(DATA_DIR, 'rates.json')
        with open(rates_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        
        # --- Save Historical Data ---
        history_path = os.path.join(DATA_DIR, 'rates_history.json')
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        history = {}
        if os.path.exists(history_path):
            try:
                with open(history_path, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except Exception:
                history = {}
        
        for currency in ["EUR", "USD", "PLN"]:
            if currency in data:
                if currency not in history:
                    history[currency] = []
                
                existing_dates = [entry["date"] for entry in history[currency]]
                if today not in existing_dates:
                    history[currency].append({
                        "date": today,
                        "buy": float(data[currency]["buy"]) if data[currency]["buy"] else 0
                    })
                else:
                    for entry in history[currency]:
                        if entry["date"] == today:
                            entry["buy"] = float(data[currency]["buy"]) if data[currency]["buy"] else 0
                
                # Keep only last 30 days
                history[currency] = history[currency][-30:]
        
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=4)
            
        print(f"✅ rates.json updated at {rates_path}")
        print(f"📊 rates_history.json updated at {history_path}")
        return {"status": "success", "data": data}

    except Exception as e:
        print(f"❌ Error: {e}")
        return {"status": "error", "message": str(e)}
