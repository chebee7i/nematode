from __future__ import print_function

from fabric.api import local, run, cd, env

env.forward_agent = 'True'

def deploy():
    local('git push')
    with cd('webapps/basic/nematode'):
        run('git pull')
        run('chmod 644 *.js *.css *.html *.png .htaccess')
