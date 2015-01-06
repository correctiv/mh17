import sys
import json
import re
import os

import requests

DOWNLOAD_PATH = 'https://tiles.odcdn.de/mh17/'
URL_MATCH = re.compile(r'.*/mh17/images/tiles/\d+/\d+/\d+\.png')
BASE_PATH = 'app/images/tiles'


def get_image_urls(data):
    for entry in data['log']['entries']:
        if URL_MATCH.match(entry['request']['url']):
            yield entry['request']['url']


def write_file(filename, content):
    if not os.path.exists(os.path.dirname(filename)):
        os.makedirs(os.path.dirname(filename))
    with open(filename, 'wb') as f:
        f.write(content)


def main(filein):
    image_path = os.path.join(os.path.dirname(__file__), BASE_PATH)
    for url in get_image_urls(json.load(filein)):
        path = url.split('/', 6)[-1]
        file_path = os.path.join(image_path, path)
        url = DOWNLOAD_PATH + path
        print path, url
        # if not os.path.exists(file_path):
        resp = requests.get(url)
        write_file(file_path, resp.content)


if __name__ == '__main__':
    main(sys.stdin)
