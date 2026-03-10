# FoxyFlag

A Firefox extension that shows the country flag of the website you're browsing in the address bar, based on GeoIP lookup of the server's IP address.

## Install

[Download the signed .xpi](https://github.com/da-z/foxyflag/releases/download/v1.0.0/foxyflag-signed.xpi) and open it in Firefox.

## How it works

1. When you navigate to a site, FoxyFlag resolves the domain to an IP address using Firefox's `dns.resolve()` API
2. The IP is looked up via [ip-api.com](http://ip-api.com) to determine the hosting country
3. The country's flag emoji is rendered and displayed as a page action icon in the address bar
4. Hover over the flag to see the country name and IP address

If the country can't be determined, a globe icon is shown instead.

## Permissions

- **dns** — resolve hostnames to IP addresses
- **webNavigation** — detect page loads
- **\<all_urls\>** — trigger on any site
- **ip-api.com** — GeoIP lookup (browsing activity is sent to this third-party service)

## Building

```sh
./rebuild-xpi.sh
```

Produces `foxyflag.xpi` in the project root (you have to submit it to ).
