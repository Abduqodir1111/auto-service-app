## Upload size limit

Workshop photos are uploaded through `api.nedvigagregat.uz`, not through
`media.nedvigagregat.uz`. Keep the API nginx server block above the backend
photo limit so nginx does not reject mobile uploads before Nest receives them.

Required in `/etc/nginx/sites-available/stomvp-api`:

```nginx
server {
    server_name api.nedvigagregat.uz;
    client_max_body_size 10m;
}

server {
    server_name admin.nedvigagregat.uz;
    client_max_body_size 10m;
}
```

The backend still enforces `PHOTO_UPLOAD_MAX_BYTES` and sanitizes images before
storing them.
