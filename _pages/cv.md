---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Check the **pdf** version of my CV [here](#Buttons){: .btn--research}.

Research Interests
======
[Meta Learning](#Buttons){: .btn--research} / [NLP](#Buttons){: .btn--research} / [Algorithmic Game Theory](#Buttons){: .btn--research} / [AI for Healthcare](#Buttons){: .btn--research}\
The list is by means not exhaustive, as I am always open to dabble into new areas 🚀. 

Education
======
* **B.Tech., Electronics and Communication Engineering, IIITN**
  * **GPA**: 8.7/10 (Rank: 5)
  * **Duration**: July'17 - May'21 (4 Years)
  * ***B.Tech.***: Bachelors of Technology
  * ***IIITN***: Indian Institute of Information Technology, Nagpur.

Work Experience
======
* **Machine Learning Researcher**
  * **Computing Systems Lab, Tata Research & Innovation Labs.**
  * **Duties**: Proposing & Implementing Deep Learning Algorithms, Accelerating DL Pipelines.
  * **Guide**: [Dr. Rekha Singhal](https://www.linkedin.com/in/rekha-singhal-7122635/), Principle Scientist & Head of Lab
  * **Joined**: September'21

Research Experience
======
* **Computing Systems Lab**, Tata Research & Innovation Labs, Mumbai
  * **Topic**: Accelerating Gradient Based Meta Learners
  * **Guide**: [Dr. Rekha Singhal](https://www.linkedin.com/in/rekha-singhal-7122635/), Principle Scientist & Head of Lab
  * **Duration**: 6 months (May'20 - Nov'20)
  1. Optimized system and model performance of a RNN based meta learner, thus achieving a speed up of 4x on training.
  2. Contributed to an open-source meta learnning library to generalize performance optimization achieved on MAML, ANIL, etc. Additionally, incorporated Data Parallel & Distributed settings.
* **Health Language Processing Lab**, University of Pennsylvania
  * **Topic**: Multi-task learning on multi-corpus health dataset
  * **Guide**: [Dr. Graciela Gonzalez-Hernandez](https://www.dbei.med.upenn.edu/bio/graciela-gonzalez-hernandez-ms-phd), Associate Professor
  * **Duration**: 2 months (Jul'20 - Sept'20)
  1. Implemented and improved on existing algorithms in literature to achieve SOTA performance for extraction of health-related information (eg., age, gender, location, symptoms, etc.) using Multi-task learning from multi-corpus twitter health dataset.
  2. Participated in WNUT'20 shared task, where our system ranked 13<sup>th</sup> all over the world. The task was to classify COVID-19 tweets as informative or not information. [DOI](10.18653/v1/2020.wnut-1.52)
* **Game Theory Lab**, Indian Insitute of Technology, Gandhinagar
  * **Topic**: Multiwinner voting with Admissible Sets
  * **Guide**: [Dr. Neeldhara Misra](http://people.iitgn.ac.in/~neeldhara/), Assistant Professor
  * **Duration**: 5 months (Nov'18 - Jan'19, May'19 - July'19)
  1. Contributed a lemma to reduce the NP-Hard problem of winner determination for connected property of candidate graph for NSAV/NAV scoring functions to polynomial time solvable for a fixed size of voters. [[Lemma](https://drive.google.com/file/d/16eH69qaIV4zR65R6IfFjx--N96TYwTv3/view)]
  2. Performed extensive research in the fields of Fair Division, Voting and studied to hardness of various problems. [Research Notes: [Voting](/files/Lecture_Series_on_Computational_Social_Choice.pdf), [Fair Division](/files/Lecture_Series_on_Fair_Division.pdf)]

Publications
======
  <ul>{% for post in site.publications %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>

Undergraduate Thesis
=====
* **Topic**: Geolocation Extraction of Twitter users
* **Guide**: [Dr. Graciela Gonzalez-Hernandez](https://www.dbei.med.upenn.edu/bio/graciela-gonzalez-hernandez-ms-phd), [Dr. Arjun Magge](https://www.linkedin.com/in/arjunmagge/)
* **Overview**: Non-availability of well annotated and balanced datasets is considered as one of the major hurdles in analysing and extracting meaningful information from health-related tweets. In the past few years, the importance of geolocation systems have increased in health care applications, advertisments, natural disaster management, etc. Herein, we present a system which makes use of the location metadata such as geo, place and profile tags; and make use of user tweets to predict the structured location of a given Twitter user. Our system is based on the previous systems Carmen and Pigeo, and we overcome some of the drawbacks present in these systems while retaining the advantages of these systems. Furthermore, we make use of FasTText and Transformer models to build a text classifier for classifying between states in a particular country. The dataset for the same is prepared by making use of Tweepy.
* **Thesis/Paper**: *to be updated soon ...*
* **Additional Material**: [Code](https://drive.google.com/drive/folders/1urA52CZ0nkzL9BMR7Up4lL2PiK4-c2N-?usp=sharing) / [Poster](/files/Poster_Geolocation_Extraction_from_Twitter.pdf) / [Presentation](/files/Geolocation_Extraction_for_Twitter.pdf)


Projects
======
* Tree MAML & Hierarchical MT-NET *(ongoing work)*
  * **Guide**: [Sébastien Arnold](http://seba1511.net/), [Dr. Tausif Diwan](https://www.linkedin.com/authwall?trk=ripf&trkInfo=AQGeiGkjpVFEkAAAAXq5_ZKo3NUTAk-LH7_xIewqBBIL8zZ6PYc1DSOSgcIumeCDu8Oy9t9ZCt84QJUIJCbFfOSsc8mzuS-hkA90IUlRHlfYfgaQWsdNFzI9QIduLBLVKEEjIC4=&originalReferer=https://www.google.com/&sessionRedirect=https%3A%2F%2Fin.linkedin.com%2Fin%2Ftausif-diwan-90584437)
  * **Motivation**: Build efficient algorithms that surpass SOTA performance on existing CV benchmark datasets.
  * *(to be updated soon)* 
* Metabolts: A library for high-end research in Meta Learning
  * **Guide**: [Sébastien Arnold](http://seba1511.net/)
  * Metabolts is a software library for meta-learning research. It builds on top of PyTorch Lightning to accelerate two aspects of meta-learning research cycle: fast-prototyping and correct reproducibility. We benchmarked results on MAML, ANIL, ProtoNets and MetaOPTs.
  * **Code Link**: [Github Link](https://github.com/learnables/learn2learn/tree/master/learn2learn/algorithms/lightning)
* WNUT 2020 Shared Task 2 : Classification of COVID Tweets
  * **Guide**: [Dr. Graciela Gonzalez-Hernandez](https://www.dbei.med.upenn.edu/bio/graciela-gonzalez-hernandez-ms-phd), [Dr. Arjun Magge](https://www.linkedin.com/in/arjunmagge/)
  * Proposed and designed a model based on BERT Transformer which included prior annotation and preprocessing of dataset to get a F1-score of 0.966. Made use of Flair framework for additional performance gain. Our model ranked $13^{th}$ accuracy-wise in the shared task which saw hundreds of participating models. 
  
Teaching Assistanship
======
  <ul>{% for post in site.teaching %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Conferences & Summer Schools Attented
======
* 38<sup>th</sup> IARCS Annual Conference on FSTTCS'18 
  * 10<sup>th</sup> December 2018 - 14<sup>th</sup> December 2018 
* ACM-W Summer School on Algorithmic Game Theory
  * 2<sup>th</sup> July 2019 - 14<sup>th</sup> July 2019
* CSA Summer School, IISC
  * 15<sup>th</sup> July 2019 - 20<sup>th</sup> July 2019
* Annual Conference of the NAACL'21 (NAACL-HLT)
  * 6<sup>th</sup> June 2021 - 11<sup>th</sup> June 2021

Achievements and leadership
======
* Bagged best research intern diary award at Summer Research Internship Program, IIT Gandhinagar.
* Received honorable mention for the project "Paraclate" in NASA Space Settlement Contest, USA.
* My team was in top 3 performing teams for 2 of the 3 shared tasks at SMM4H'21 Workshop.
* I was a student placement coordinator at my institute for 1.5 years. I mainly dealt with establishing network with companies, and maintaining database of upcoming internships/campus drives.
* Activities at Undergraduate Institute:
  * I was a part of the founding committee of IIITN's coding club community *dotSlash (./)*.
  * I was the co-head of the Line Follower event in IIITN's technical fest (*Tantrafiesta*).
  * I was the head for Samarth event in IIITN's cultural fest (*Abhivyakti*). Samarth is a theme event of Abhivyakti that seeks to spread awareness about the physically challenged children in India.

Technical Skills
======
1. **Programming Languages**&emsp;&emsp;&emsp; C \| Python \| HDL 
2. **Frameworks**&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp; Flair \| KTrain \| learn2learn \| HuggingFace
3. **Libraries**&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp; Keras \| Tensorflow 2.0 \| PyTorch
4. **Systems/Platforms**&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp; Git \| Bash \| Linux \| CentOS
5. **Markup Templating**&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp; HTML \| CSS \| Jekyll
6. **Data Visualization**&emsp;&emsp;&emsp;&emsp;&emsp;&emsp; Seaborn \| Matplotlib
7. **Miscellaneous Softwares/Tools** Latex \| MATLAB \| RPi \| CADFEKO
