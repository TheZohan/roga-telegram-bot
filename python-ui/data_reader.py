import os
from dotenv import load_dotenv
import redis
import csv
import json

# Specify the path to your .env file (one folder up)
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')

# Load environment variables from .env file
load_dotenv(dotenv_path)

# Get Redis connection details from environment variables
redis_host = os.getenv('REDISHOST', '127.0.0.1')  # Default to localhost for local connection
redis_port = os.getenv('REDISPORT', 6379)  # Default port for Redis

# Connect to the Redis server
r = redis.Redis(host=redis_host, port=int(redis_port), db=0)

key = "user:325270109"
item = r.get(key)
decoded = json.loads(item.decode('utf-8'))
print(decoded)
# Specify the key of the list you want to read
# list_key = "messages:493839176"

# # Get the entire list
# my_list = r.lrange(list_key, 0, -1)

# # Convert bytes to string and then to JSON
# my_list = [json.loads(item.decode('utf-8')) for item in my_list]

# Define the CSV file path
# csv_file_path = 'exported_list.csv'

# # Write the list to a CSV file
# with open(csv_file_path, mode='w', newline='', encoding='utf-8') as file:
#     writer = csv.DictWriter(file, fieldnames=["id", "userId", "role", "timestamp", "message"])
#     writer.writeheader()
#     for item in my_list:
#         writer.writerow(item)

# print(f"List contents have been exported to {csv_file_path}")
