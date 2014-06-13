from __future__ import print_function

from fabric.api import local, run, cd, env

def hello():
    print("Hello world!")

def show():
    with cd('webapps/basic/nematode'):
        run('ls')
