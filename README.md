<a name="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/louis77/nova-http-client">
	<img src="extension.png" alt="Logo" width="80" height="80">
  </a>
</div>

# nova-http-client

**HTTP Client** is an extension for the [Nova editor](https://nova.app) and provides a **Run HTTP** editor command to make HTTP calls from a *.http file.

![](https://raw.githubusercontent.com/louis77/nova-http-client/main/screenshot1.gif)

## Getting Started

1. Create a file with "http" extension

2. Write a HTTP verb and URL in a line:

```
GET https://wikipedia.org
```

3. Put the cursor on the line, right-click and click on the "Run HTTP" command (or Editor > Run HTTP).

4. HTTP Client will open a new editor with the result of the request (HTTP & body). It detects if the response is HTML or JSON and selects the appropriate syntax in Nova.

## Roadmap

HTTP Client is still very simple and doesn't provide support for HTTP headers or body (yet).
Let me know if you find the extension useful and what features you want to see.

- [ ] Add support to provide HTTP headers
- [ ] Add support to provide HTTP body
- [ ] Add HTTP response headers in output
- [ ] Add latency in output

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## License

Distributed under the GPL-3-or-later. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- CONTACT -->
## Contact

Louis Brauer - [@BrauerLouis1](https://twitter.com/BrauerLouis1) - louis@brauer.family

Project Link: [https://github.com/louis77/nova-http-client](https://github.com/louis77/nova-http-client)

<p align="right">(<a href="#readme-top">back to top</a>)</p>