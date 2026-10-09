from app.database import supabase

tables = ["users", "vehicles", "routes", "route_alternatives", "packages", "deliveries", "disruptions"]

results = [supabase.table(table).select("*").limit(100).execute() for table in tables]

print("\n".join([tables[i] + ": " + str(len(results[i].data)) + " records" for i in range(len(tables))]))
