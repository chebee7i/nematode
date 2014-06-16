import MySQLdb
from collections import defaultdict
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn

dbhost = 'localhost'
dbname = 'nematode'
dbuser = 'nematode'
dbpass = 'nematode'
dbport = 3306
db = MySQLdb.connect(host=dbhost,
                     user=dbuser,
                     passwd=dbpass,
                     db=dbname,
                     port=dbport)

c = db.cursor()

pairs = [('easy', 20), ('hard', 50)]
means = defaultdict(list)
stds = defaultdict(list)
for pair in pairs:
    stmnt = """SELECT nematode, score from scores where landscape=%s and moves=%s"""
    c.execute(stmnt, pair)
    rows = c.fetchall()
    landscape = pair[0]
    scores = defaultdict(list)
    for nematode, score in rows:
        scores[int(nematode)].append(score)
    # Calculate means...
    for nematode in range(4):
        means[landscape].append(np.mean(scores[nematode]))
        stds[landscape].append(np.std(scores[nematode], ddof=1))

N = 4
ind = np.arange(N)  # the x locations for the groups
width = 0.35       # the width of the bars

fig, ax = plt.subplots()
rects_easy = ax.bar(ind, means['easy'], width, color='lightblue',
                    yerr=stds['easy'], ecolor='gray')
rects_hard = ax.bar(ind+width, means['hard'], width, color='indianred',
                    yerr=stds['hard'], ecolor='gray')

ax.set_ylabel('Scores')
ax.set_title('Scores by Environment')
ax.set_xticks(ind+width)
ax.set_xticklabels( ('Zack', 'Kelly', 'Slater', 'Lisa') )
ax.set_xlabel('Nematode')
ax.legend( (rects_easy[0], rects_hard[0]), ('Easy', 'Hard'), loc='best' )

def autolabel(rects):
    # attach some text labels
    for rect in rects:
        height = rect.get_height()
        ax.text(rect.get_x()+rect.get_width()/2., 1.1*height, '%d'%int(height),
                ha='center', va='bottom')

autolabel(rects_easy)
autolabel(rects_hard)

plt.savefig('histogram.pdf')

