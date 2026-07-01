import os
import json
from pathlib import Path
import requests

try:
    config_path = Path.home() / '.lemma' / 'config.json'
    print('Config exists:', config_path.exists())
    if config_path.exists():
        with open(config_path, 'r') as f:
            config = json.load(f)
            active_server = config.get('active_server', 'cloud')
            server_config = config.get('servers', {}).get(active_server, {})
            refresh_token = server_config.get('refresh_token')
            print('Active Server:', active_server)
            print('Has token:', bool(server_config.get('token')))
            print('Has refresh_token:', bool(refresh_token))
            
            if refresh_token:
                base_url = server_config.get('base_url', 'https://api.lemma.work')
                print('Attempting refresh with URL:', f'{base_url.rstrip("/")}/auth/cli/refresh')
                response = requests.post(
                    f'{base_url.rstrip("/")}/auth/cli/refresh',
                    json={'refresh_token': refresh_token},
                    headers={'Accept': 'application/json'}
                )
                print('Refresh Status:', response.status_code)
                print(response.json())
                if response.status_code >= 400:
                    print('Error Response:', response.text)
                else:
                    print('Success!')
    else:
        print('No config.json found')
except Exception as e:
    print(e)
