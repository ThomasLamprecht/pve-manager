Ext.define('PVE.qemu.CloudInit', {
    extend: 'Proxmox.grid.PendingObjectGrid',
    xtype: 'pveCiPanel',

    tbar: [
	{
	    xtype: 'proxmoxButton',
	    disabled: true,
	    dangerous: true,
	    confirmMsg: function(rec) {
		var me = this.up('grid');
		var warn = gettext('Are you sure you want to remove entry {0}');

		var entry = rec.data.key;
		var msg = Ext.String.format(warn, "'"
		    + me.renderKey(entry, {}, rec) + "'");

		return msg;
	    },
	    enableFn: function(record) {
		var me = this.up('grid');
		var caps = Ext.state.Manager.get('GuiCap');
		if (me.rows[record.data.key].never_delete ||
		    !caps.vms['VM.Config.Network']) {
		    return false;
		}
		return true;
	    },
	    handler: function() {
		var me = this.up('grid');
	    },
	    text: gettext('Remove')
	},
	{
	    xtype: 'proxmoxButton',
	    disabled: true,
	    handler: function() {
		var me = this.up('grid');
		me.run_editor();
	    },
	    text: gettext('Edit')
	},
	'-',
	{
	    xtype: 'button',
	    itemId: 'savebtn',
	    text: gettext('Regenerate Image'),
	    handler: function() {
		var me = this.up('grid');
		var eject_params = {};
		var insert_params = {};
		var disk = PVE.Parser.parseQemuDrive(me.ciDriveId, me.ciDrive);
		var storage = '';
		var stormatch = disk.file.match(/^([^\:]+)\:/);
		if (stormatch) {
		    storage = stormatch[1];
		}
		eject_params[me.ciDriveId] = 'none,media=cdrom';
		insert_params[me.ciDriveId] = storage + ':cloudinit';

		var failure = function(response, opts) {
		    Ext.Msg.alert('Error', response.htmlStatus);
		};

		Proxmox.Utils.API2Request({
		    url: me.baseurl + '/config',
		    waitMsgTarget: me,
		    method: 'PUT',
		    params: eject_params,
		    failure: failure,
		    callback: function() {
			Proxmox.Utils.API2Request({
			    url: me.baseurl + '/config',
			    waitMsgTarget: me,
			    method: 'PUT',
			    params: insert_params,
			    failure: failure,
			    callback: function() {
				me.reload();
			    }
			});
		    }
		});
	    }
	}
    ],

    border: false,

    set_button_status: function(rstore, records, success) {
	if (!success || records.length < 1) {
	    return;
	}
	var me = this;
	var found;
	records.forEach(function(record) {
	    if (found) {
		return;
	    }
	    var id = record.data.key;
	    var value = record.data.value;
	    var ciregex = new RegExp("vm-" + me.pveSelNode.data.vmid + "-cloudinit");
		if (id.match(/^(ide|scsi|sata)\d+$/) && ciregex.test(value)) {
		    found = id;
		    me.ciDriveId = found;
		    me.ciDrive = value;
		}
	});

	me.down('#savebtn').setDisabled(!found);
	me.setDisabled(!found);
	if (!found) {
	    me.getView().mask(gettext('No CloudInit Drive found'), ['pve-static-mask']);
	} else {
	    me.getView().unmask();
	}
    },

    renderKey: function(key, metaData, rec, rowIndex, colIndex, store) {
	var me = this;
	var rows = me.rows;
	var rowdef = rows[key] || {};

	var icon = "";
	if (rowdef.iconCls) {
	    icon = '<i class="' + rowdef.iconCls + '"></i> ';
	}
	return icon + (rowdef.header || key);
    },

    listeners: {
	activate: function () {
	    var me = this;
	    me.rstore.startUpdate();
	},
	itemdblclick: function() {
	    var me = this;
	    me.run_editor();
	}
    },

    initComponent: function() {
	var me = this;

	var nodename = me.pveSelNode.data.node;
	if (!nodename) {
	    throw "no node name specified";
	}

	var vmid = me.pveSelNode.data.vmid;
	if (!vmid) {
	    throw "no VM ID specified";
	}
	var caps = Ext.state.Manager.get('GuiCap');
	me.baseurl = '/api2/extjs/nodes/' + nodename + '/qemu/' + vmid;
	me.url =  me.baseurl + '/pending';
	me.editorConfig.url = me.baseurl + '/config';
	me.editorConfig.pveSelNode = me.pveSelNode;

	/*jslint confusion: true*/
	/* editor is string and object */
	me.rows = {
	    ciuser: {
		header: gettext('User'),
		iconCls: 'fa fa-user',
		never_delete: true,
		defaultValue: '',
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('User'),
		    items: [
			{
			    xtype: 'proxmoxtextfield',
			    deleteEmpty: true,
			    emptyText: Proxmox.Utils.defaultText,
			    fieldLabel: gettext('User'),
			    name: 'ciuser'
			}
		    ]
		} : undefined,
		renderer: function(value) {
		    return value || Proxmox.Utils.defaultText;
		}
	    },
	    cipassword: {
		header: gettext('Password'),
		iconCls: 'fa fa-unlock',
		never_delete: true,
		defaultValue: '',
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Password'),
		    items: [
			{
			    xtype: 'proxmoxtextfield',
			    inputType: 'password',
			    deleteEmpty: true,
			    emptyText: Proxmox.Utils.noneText,
			    fieldLabel: gettext('Password'),
			    name: 'cipassword'
			}
		    ]
		} : undefined,
		renderer: function(value) {
		    return value || Proxmox.Utils.noneText;
		}
	    },
	    searchdomain: {
		header: gettext('DNS domain'),
		iconCls: 'fa fa-globe',
		editor: caps.vms['VM.Config.Network'] ? 'PVE.lxc.DNSEdit' : undefined,
		never_delete: true,
		defaultValue: gettext('use host settings')
	    },
	    nameserver: {
		header: gettext('DNS servers'),
		iconCls: 'fa fa-globe',
		editor: caps.vms['VM.Config.Network'] ? 'PVE.lxc.DNSEdit' : undefined,
		never_delete: true,
		defaultValue: gettext('use host settings')
	    },
	    sshkeys: {
		header: gettext('SSH public key'),
		iconCls: 'fa fa-key',
		editor: caps.vms['VM.Config.Network'] ? 'PVE.qemu.SSHKeyEdit' : undefined,
		never_delete: true,
		renderer: function(value) {
		    value = decodeURIComponent(value);
		    var keys = value.split('\n');
		    var text = [];
		    keys.forEach(function(key) {
			if (key.length) {
			    // First erase all quoted strings (eg. command="foo"
			    var v = key.replace(/"(?:\\.|[^"\\])*"/g, '');
			    // Now try to detect the comment:
			    var res = v.match(/^\s*(\S+\s+)?(?:ssh-(?:dss|rsa|ed25519)|ecdsa-sha2-nistp\d+)\s+\S+\s+(.*?)\s*$/, '');
			    if (res) {
				key = Ext.String.htmlEncode(res[2]);
				if (res[1]) {
				    key += ' <span style="color:gray">(' + gettext('with options') + ')</span>';
				}
				text.push(key);
				return;
			    }
			    // Most likely invalid at this point, so just stick to
			    // the old value.
			    text.push(Ext.String.htmlEncode(key));
			}
		    });
		    if (text.length) {
			return text.join('<br>');
		    } else {
			return Proxmox.Utils.noneText;
		    }
		},
		defaultValue: ''
	    }
	};
	var i;
	var ipconfig_renderer = function(value, md, record, ri, ci, store, pending) {
	    var id = record.data.key;
	    var match = id.match(/^net(\d+)$/);
	    var val = '';
	    if (match) {
		val = me.getObjectValue('ipconfig'+match[1], '', pending);
	    }
	    return val;
	};
	for (i = 0; i < 32; i++) {
	    // we want to show an entry for every network device
	    // even if it is empty
	    me.rows['net' + i.toString()] = {
		multiKey: ['ipconfig' + i.toString(), 'net' + i.toString()],
		header: gettext('IP Config') + ' (net' + i.toString() +')',
		editor: caps.vms['VM.Config.Network'] ? 'PVE.qemu.IPConfigEdit' : undefined,
		iconCls: 'fa fa-exchange',
		renderer: ipconfig_renderer
	    };
	    me.rows['ipconfig' + i.toString()] = {
		visible: false
	    };
	}
	/*jslint confusion: false*/

	PVE.Utils.forEachBus(['ide', 'scsi', 'sata'], function(type, id) {
	    me.rows[type+id] = {
		visible: false
	    };
	});
	me.callParent();
	me.mon(me.rstore, 'load', me.set_button_status, me);
    }
});
