import ee

# Inizializza (usa il token salvato)
try:
    ee.Initialize(project="YOUR_PROJECT_ID")  # ← SOSTITUISCI QUI CON IL TUO PROJECT ID
    print("✅ Autenticazione riuscita!")
except Exception as e:
    print(f"❌ Errore: {e}")
    exit(1)

# Test semplice
try:
    test_collection = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    first_image = test_collection.first()
    print(f"✅ Connessione a Earth Engine OK")
    print(f"   Prime immagine Landsat: {first_image.get('system:index').getInfo()}")
except Exception as e:
    print(f"❌ Errore connessione: {e}")
    exit(1)

print("\n✨ Tutto è pronto per il passo 2!")