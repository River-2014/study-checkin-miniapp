Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    closable: { type: Boolean, value: true }
  },

  methods: {
    onClose: function() {
      if (this.properties.closable) {
        this.triggerEvent('close');
      }
    },

    stopPropagation: function() {}
  }
});
