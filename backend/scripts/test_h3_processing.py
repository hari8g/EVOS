
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from h3_engine.processor import process_csv_to_h3

if __name__ == "__main__":
    # Example CSV
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'data/raw_csvs/test.csv'

    result = process_csv_to_h3(filepath)

    print(result.head())
