Since we are a lot of people contributing to the specification, we have defined a few guidelines. Please follow them and we will be able to review your PR a lot faster when we don't have to point out style and other non-technical issues. Thank you.

### W3C Legal
Contributions to this repository are intended to become part of Recommendation-track documents governed by the
[W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20200915/) and
[Document License](https://www.w3.org/Consortium/Legal/copyright-documents). To bring substantive contributions
to specifications, you must either participate in the relevant W3C Working Group or make a non-member patent
licensing commitment.

### Adding/removing contributors
If you are not the sole contributor to a contribution (pull request), please identify all
contributors in the pull request comment.

To add a contributor (other than yourself, that's automatic), mark them one per line as follows:

```
+@github_username
```

If you added a contributor by mistake, you can remove them in a comment with:

```
-@github_username
```

If you are making a pull request on behalf of someone else but you had no part in designing the
feature, you can remove yourself with the above syntax.

### Notes on bikeshedding :bicyclist:
To compile `index.bs` into `index.html` , I'm using the online compiler:
```
curl https://api.csswg.org/bikeshed/ -F file=@index.bs -F force=1 > index.html
```
if the produced file has a strange size (i.e. zero, a few KBs), then something went terribly wrong; run instead:
```
curl https://api.csswg.org/bikeshed/ -F file=@index.bs -F output=err
```
and try to figure out why `bikeshed` did not like the `.bs` :'(
