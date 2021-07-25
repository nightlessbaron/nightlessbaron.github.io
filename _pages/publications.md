---
layout: archive
title: "Publications"
permalink: /publications/
author_profile: true
---

{% if site.author.googlescholar %}
  You can also find my articles on my <a href="{{site.author.googlescholar}}">Google Scholar</a> profile.
{% endif %}

{% include base_path %}

JOURNAL
======

{% for post in site.publications reversed %}
  {% if post.pubtype == 'journal' %}
      {% include archive-single.html %}
  {% endif %}
{% endfor %}

CONFERENCE
======

{% for post in site.publications reversed %}
  {% if post.pubtype == 'conference' %}
      {% include archive-single.html %}
  {% endif %}
{% endfor %}

WORKSHOP
======
{% for post in site.publications reversed %}
  {% if post.pubtype == 'workshop' %}
      {% include archive-single.html %}
  {% endif %}
{% endfor %}